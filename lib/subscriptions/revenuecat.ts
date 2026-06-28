import {
  REVENUECAT_ENTITLEMENT_PRO,
  type SubscriptionTier,
} from "@/lib/subscriptions/constants";

type RevenueCatEntitlement = {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  product_identifier?: string;
};

type RevenueCatSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
  };
};

function parseExpiry(entitlement: RevenueCatEntitlement | undefined): Date | null {
  if (!entitlement?.expires_date) return null;
  const parsed = new Date(entitlement.expires_date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function tierFromRevenueCatEntitlement(
  entitlement: RevenueCatEntitlement | undefined,
): { tier: SubscriptionTier; expiresAt: Date | null } {
  if (!entitlement) {
    return { tier: "free", expiresAt: null };
  }

  const expiresAt = parseExpiry(entitlement);
  const graceExpiresAt = entitlement.grace_period_expires_date
    ? parseExpiry({ expires_date: entitlement.grace_period_expires_date })
    : null;
  const effectiveExpiry = graceExpiresAt ?? expiresAt;

  if (effectiveExpiry && effectiveExpiry.getTime() <= Date.now()) {
    return { tier: "free", expiresAt: effectiveExpiry };
  }

  return { tier: "pro", expiresAt: effectiveExpiry };
}

export async function fetchRevenueCatSubscriber(appUserId: string) {
  const secret = process.env.REVENUECAT_SECRET_API_KEY;
  if (!secret) {
    throw new Error("Missing REVENUECAT_SECRET_API_KEY");
  }

  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RevenueCat lookup failed (${response.status}): ${text}`);
  }

  return (await response.json()) as RevenueCatSubscriberResponse;
}

export async function resolveTierFromRevenueCat(appUserId: string) {
  const payload = await fetchRevenueCatSubscriber(appUserId);
  const entitlement = payload.subscriber?.entitlements?.[REVENUECAT_ENTITLEMENT_PRO];
  return tierFromRevenueCatEntitlement(entitlement);
}

export function tierFromWebhookEntitlements(
  entitlements: Record<string, RevenueCatEntitlement> | undefined,
) {
  return tierFromRevenueCatEntitlement(entitlements?.[REVENUECAT_ENTITLEMENT_PRO]);
}
