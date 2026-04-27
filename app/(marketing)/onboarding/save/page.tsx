"use client";

import { useEffect, useState } from "react";
import { SignInButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import { Card } from "@/components/shared/ui";
import { IconSparkle } from "@/components/shared/icons";
import { getResumeStep, getVault } from "@/lib/onboarding/vault";
import { ONBOARDING_EVENTS, fireEvent } from "@/lib/onboarding/funnel-events";
import type { OnboardingSampleGrade } from "@/lib/onboarding/types";

export default function OnboardingSavePage() {
  const router = useRouter();
  const [grade, setGrade] = useState<OnboardingSampleGrade | null>(null);

  // Hydrate from vault on mount. Calling setGrade in the effect is the
  // intent — we're synchronizing local component state with localStorage.
  useEffect(() => {
    fireEvent(ONBOARDING_EVENTS.SAVE_PROGRESS);
    const vault = getVault();
    if (!vault) {
      router.replace("/onboarding/hook");
      return;
    }
    if (!vault.sampleGrade) {
      const step = getResumeStep(vault);
      router.replace(`/onboarding/${step}`);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGrade(vault.sampleGrade);
  }, [router]);

  if (!grade) {
    return (
      <OnboardingShell step={6} backHref="/onboarding/result">
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={6} backHref="/onboarding/result">
      <div className="text-center">
        <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-xl shadow-indigo-300/40">
          <IconSparkle className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-indigo-950 sm:text-4xl">
          Save your first graded test
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-slate-500">
          Don&rsquo;t lose this &mdash; sign up to keep your progress and start grading real stacks.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <Card className="border-indigo-200">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
            Your sample grade
          </p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-indigo-600">{grade.marksEarned}</span>
              <span className="text-lg font-semibold text-slate-400">/ {grade.maxMarks}</span>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              Graded
            </span>
          </div>
          {grade.feedback ? (
            <p className="mt-3 text-sm leading-relaxed text-indigo-950">{grade.feedback}</p>
          ) : null}
        </Card>

        <div className="pt-2">
          <SignInButton mode="modal" fallbackRedirectUrl="/onboarding-sync">
            <button
              type="button"
              onClick={() => fireEvent(ONBOARDING_EVENTS.AUTH_STARTED)}
              className="cursor-pointer w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-300/40 hover:from-indigo-700 hover:to-violet-700 transition-all duration-200"
            >
              Save my progress &mdash; sign up free
            </button>
          </SignInButton>
          <p className="mt-3 text-center text-xs text-slate-400">
            Already have an account?{" "}
            <SignInButton mode="modal" fallbackRedirectUrl="/onboarding-sync">
              <button
                type="button"
                onClick={() => fireEvent(ONBOARDING_EVENTS.AUTH_STARTED)}
                className="cursor-pointer font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Sign in
              </button>
            </SignInButton>
          </p>
        </div>
      </div>
    </OnboardingShell>
  );
}
