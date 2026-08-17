"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  PRO_ANNUAL_PRICE_LABEL,
  PRO_MONTHLY_PRICE_LABEL,
  PRO_PLANS,
  type SubscriptionPlanId,
  type SubscriptionSummary,
} from "@/lib/subscriptions/constants";
import {
  fetchCurrentOffering,
  getManagementUrl,
  isUserCancelledError,
  isWebBillingConfigured,
  pickPackageForPlan,
  purchasePlan,
} from "@/lib/subscriptions/purchases-web";
import { handleJson } from "@/lib/dashboard-client";
import { Badge, Card, SectionHeader, btnPrimary, btnSecondary } from "@/components/shared/ui";

type PackageAvailability = Record<SubscriptionPlanId, boolean>;

export default function BillingPageClient() {
  const { userId, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();

  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>("annual");
  const [availability, setAvailability] = useState<PackageAvailability>({
    monthly: false,
    annual: false,
  });
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const billingReady = isWebBillingConfigured();

  const refreshSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const payload = await handleJson<{ subscription: SubscriptionSummary }>(
        await fetch("/api/me/subscription", { cache: "no-store" }),
      );
      setSubscription(payload.subscription);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load subscription.");
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const syncFromRevenueCat = useCallback(async () => {
    const payload = await handleJson<{ subscription: SubscriptionSummary }>(
      await fetch("/api/me/subscription/sync", { method: "POST" }),
    );
    setSubscription(payload.subscription);
  }, []);

  useEffect(() => {
    if (!authLoaded || !userId) return;
    void refreshSummary();
  }, [authLoaded, userId, refreshSummary]);

  useEffect(() => {
    if (!authLoaded || !userId || !billingReady) return;
    let cancelled = false;
    setPackagesLoading(true);
    (async () => {
      try {
        const offering = await fetchCurrentOffering(userId);
        if (cancelled) return;
        setAvailability({
          monthly: Boolean(pickPackageForPlan(offering, "monthly")),
          annual: Boolean(pickPackageForPlan(offering, "annual")),
        });
        // Prefer annual when both exist.
        if (pickPackageForPlan(offering, "annual")) {
          setSelectedPlan("annual");
        } else if (pickPackageForPlan(offering, "monthly")) {
          setSelectedPlan("monthly");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load Pro plans from RevenueCat.",
          );
        }
      } finally {
        if (!cancelled) setPackagesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoaded, userId, billingReady]);

  const usageCopy = useMemo(() => {
    if (!subscription) return null;
    if (subscription.isPro) {
      return "Unlimited classes and tests graded while Pro is active.";
    }
    const grades =
      subscription.gradeLimit == null
        ? `${subscription.gradesUsedThisMonth} tests graded this month`
        : `${subscription.gradesUsedThisMonth} / ${subscription.gradeLimit} tests graded this month`;
    const classes =
      subscription.classLimit == null
        ? `${subscription.classesOwned} classes`
        : `${subscription.classesOwned} / ${subscription.classLimit} classes`;
    return `${classes} · ${grades}`;
  }, [subscription]);

  async function onUpgrade() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      // Omit htmlTarget so Purchases.js mounts a full-page modal. Passing our
      // zero-height host made checkout render invisibly while this promise hung.
      await purchasePlan({
        appUserId: userId,
        planId: selectedPlan,
        customerEmail: user?.primaryEmailAddress?.emailAddress ?? null,
      });
      await syncFromRevenueCat();
      setStatus("Welcome to Pro — your limits are unlocked.");
    } catch (err) {
      if (isUserCancelledError(err)) return;
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onManage() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const url = await getManagementUrl(userId);
      if (!url) {
        setError("No management link yet. If you subscribed on iOS, manage it in Settings → Apple ID → Subscriptions.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open billing portal.");
    } finally {
      setBusy(false);
    }
  }

  async function onRefresh() {
    setBusy(true);
    setError(null);
    try {
      await syncFromRevenueCat();
      setStatus("Subscription refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh subscription.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/t" className="text-sm font-semibold text-pen hover:text-pen-deep">
          ← Back to dashboard
        </Link>
      </div>

      <SectionHeader
        title="Billing"
        subtitle="Pro unlocks unlimited classes and grading on web and iOS."
      />

      <Card className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-ink">Current plan</h2>
          {subscription?.isPro ? (
            <Badge variant="green">Pro</Badge>
          ) : (
            <Badge variant="gray">Free</Badge>
          )}
        </div>
        {loadingSummary ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : (
          <>
            <p className="text-sm text-ink-soft">{usageCopy}</p>
            {subscription?.subscriptionExpiresAt ? (
              <p className="text-xs text-ink-faint">
                Renews / expires{" "}
                {new Date(subscription.subscriptionExpiresAt).toLocaleDateString()}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className={btnSecondary} disabled={busy} onClick={() => void onRefresh()}>
                Refresh status
              </button>
              {subscription?.isPro ? (
                <button type="button" className={btnSecondary} disabled={busy || !billingReady} onClick={() => void onManage()}>
                  Manage subscription
                </button>
              ) : null}
            </div>
          </>
        )}
      </Card>

      {!subscription?.isPro ? (
        <Card className="mt-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-ink">Upgrade to Pro</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {PRO_MONTHLY_PRICE_LABEL} or {PRO_ANNUAL_PRICE_LABEL}. Same entitlement as the iOS app.
            </p>
          </div>

          {!billingReady ? (
            <p className="rounded-xl bg-pen-wash px-4 py-3 text-sm text-pen-deep">
              Web checkout isn’t configured yet. Add{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_REVENUECAT_WEB_API_KEY</code> in
              Vercel, then create monthly ({PRO_MONTHLY_PRICE_LABEL}) and annual (
              {PRO_ANNUAL_PRICE_LABEL}) products in RevenueCat Billing.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {PRO_PLANS.map((plan) => {
                  const available = availability[plan.id];
                  const selected = selectedPlan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      disabled={packagesLoading || (!available && !packagesLoading)}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        selected
                          ? "border-pen bg-pen-wash/40 ring-2 ring-pen/30"
                          : "border-line bg-cream hover:border-pen/40"
                      } ${!available && !packagesLoading ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-ink">{plan.label}</span>
                        {plan.badge ? <Badge variant="green">{plan.badge}</Badge> : null}
                      </div>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{plan.priceLabel}</p>
                      <p className="mt-1 text-xs text-ink-faint">{plan.intervalLabel}</p>
                      {!available && !packagesLoading ? (
                        <p className="mt-2 text-xs text-pen-deep">Not in current offering yet</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className={`${btnPrimary} w-full sm:w-auto`}
                disabled={busy || packagesLoading || !availability[selectedPlan]}
                onClick={() => void onUpgrade()}
              >
                {busy
                  ? "Complete checkout in the window…"
                  : `Continue with ${selectedPlan === "annual" ? "annual" : "monthly"} Pro`}
              </button>
            </>
          )}
        </Card>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl border border-pen/30 bg-pen-wash px-4 py-3 text-sm text-pen-deep">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="mt-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink">
          {status}
        </p>
      ) : null}

      <p className="mt-8 text-xs text-ink-faint">
        Purchases on the web use RevenueCat Billing (Stripe). iOS App Store subscriptions are managed
        through Apple. Both unlock the same Pro entitlement on your Graider account.
      </p>
    </div>
  );
}
