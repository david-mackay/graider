"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import { IconSparkle } from "@/components/shared/icons";
import { clearVault, getVault } from "@/lib/onboarding/vault";
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
    if (!vault || !vault.sampleGrade) {
      setState({ kind: "redirecting" });
      router.replace("/t/grade");
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
          message: payload.error ?? "We couldn't save your first graded test. Try again.",
        });
        return;
      }
      clearVault();
      setState({ kind: "redirecting" });
      router.replace("/t/grade?welcome=1");
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
    void runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-50/60 via-white to-violet-50/30 px-4 py-12">
      <div className="w-full max-w-md">
        <Card className="border-indigo-200">
          <div className="text-center">
            <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-300/40">
              <IconSparkle className="h-7 w-7 text-white" />
            </div>

            {state.kind === "loading" || state.kind === "redirecting" ? (
              <>
                <h1 className="text-lg font-bold text-indigo-950">
                  Saving your first graded test&hellip;
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Setting up your starter class and seeding the sample grade.
                </p>
                <div className="mt-6 flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                </div>
              </>
            ) : null}

            {state.kind === "error" ? (
              <>
                <h1 className="text-lg font-bold text-indigo-950">Something went wrong</h1>
                <p className="mt-2 text-sm text-red-700">{state.message}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void runSync()}
                    className={btnPrimary}
                  >
                    Try Again
                  </button>
                  <Link href="/t/grade" className={btnSecondary}>
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
