"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import { BrandMark } from "@/components/shared/Brand";
import { clearVault, getVault } from "@/lib/onboarding/vault";
import { ONBOARDING_EVENTS, fireEvent } from "@/lib/onboarding/funnel-events";
import { hasGradedStudents } from "@/lib/onboarding/types";
import type { OnboardingSyncResponse } from "@/lib/types";

type SyncState =
  | { kind: "loading" }
  | { kind: "redirecting" }
  | { kind: "error"; message: string };

export default function OnboardingSyncPage() {
  const router = useRouter();
  const [state, setState] = useState<SyncState>({ kind: "loading" });
  const ranRef = useRef(false);

  async function runSync() {
    setState({ kind: "loading" });
    const vault = getVault();
    if (!vault || !hasGradedStudents(vault)) {
      setState({ kind: "redirecting" });
      router.replace("/t");
      return;
    }

    try {
      const res = await fetch("/api/onboarding/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vault),
      });
      const payload = (await res.json()) as OnboardingSyncResponse & { error?: string };
      if (!res.ok) {
        setState({
          kind: "error",
          message: payload.error ?? "We couldn't save your graded class. Try again.",
        });
        return;
      }
      fireEvent(ONBOARDING_EVENTS.CLASS_SYNCED, { created: payload.created });
      clearVault();
      setState({ kind: "redirecting" });
      router.replace("/t?welcome=1");
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error — please try again.",
      });
    }
  }

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    fireEvent(ONBOARDING_EVENTS.AUTH_COMPLETE);
    void runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-rise">
        <Card>
          <div className="text-center">
            <div className="mx-auto mb-5 inline-flex">
              <BrandMark className="h-14 w-14" />
            </div>

            {state.kind === "loading" || state.kind === "redirecting" ? (
              <>
                <h1 className="font-display text-xl font-semibold text-ink">
                  Saving your graded class&hellip;
                </h1>
                <p className="mt-2 text-sm text-ink-soft">
                  Setting up your starter class and adding each graded student.
                </p>
                <div className="mt-6 flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-pen border-t-transparent" />
                </div>
              </>
            ) : null}

            {state.kind === "error" ? (
              <>
                <h1 className="font-display text-xl font-semibold text-ink">Something went wrong</h1>
                <p className="mt-2 text-sm font-bold text-pen-deep">{state.message}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void runSync()}
                    className={btnPrimary}
                  >
                    Try Again
                  </button>
                  <Link href="/t" className={btnSecondary}>
                    Skip
                  </Link>
                </div>
              </>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
