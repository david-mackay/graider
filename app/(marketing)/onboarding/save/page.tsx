"use client";

import { useEffect, useState } from "react";
import { SignInButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import { Card } from "@/components/shared/ui";
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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-pen border-t-transparent" />
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={6} backHref="/onboarding/result">
      <div className="text-center">
        <p className="font-hand text-2xl text-pen">One last thing</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Save your first graded test
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-ink-soft">
          Don&rsquo;t lose this &mdash; sign up to keep your progress and start grading real stacks.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <Card>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">
            Your sample grade
          </p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="font-hand -rotate-2 text-4xl font-bold text-pen">
              {grade.marksEarned}/{grade.maxMarks}
            </p>
            <span className="rounded-full bg-moss-wash px-2.5 py-0.5 text-xs font-bold text-moss-deep ring-1 ring-moss/30">
              Graded
            </span>
          </div>
          {grade.feedback ? (
            <p className="mt-3 font-hand text-xl leading-snug text-pen-deep">{grade.feedback}</p>
          ) : null}
        </Card>

        <div className="pt-2">
          <SignInButton mode="modal" fallbackRedirectUrl="/onboarding-sync">
            <button
              type="button"
              onClick={() => fireEvent(ONBOARDING_EVENTS.AUTH_STARTED)}
              className="w-full cursor-pointer rounded-full bg-pen px-8 py-3.5 text-base font-bold text-white shadow-lifted transition-all duration-150 hover:bg-pen-deep active:scale-[0.98]"
            >
              Save my progress &mdash; sign up free
            </button>
          </SignInButton>
          <p className="mt-3 text-center text-xs text-ink-faint">
            Already have an account?{" "}
            <SignInButton mode="modal" fallbackRedirectUrl="/onboarding-sync">
              <button
                type="button"
                onClick={() => fireEvent(ONBOARDING_EVENTS.AUTH_STARTED)}
                className="cursor-pointer font-bold text-pen hover:text-pen-deep"
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
