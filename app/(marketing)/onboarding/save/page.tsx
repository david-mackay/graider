"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import AuthMethodPanel from "@/components/shared/AuthMethodPanel";
import { Card } from "@/components/shared/ui";
import { getResumeStep, getVault } from "@/lib/onboarding/vault";
import { ONBOARDING_EVENTS, fireEvent } from "@/lib/onboarding/funnel-events";
import { normalizeStudents, type GradedOnboardingStudent } from "@/lib/onboarding/types";
import { hasClerkPublishableKey } from "@/lib/clerk-config";

function AuthFallback({ redirectTo }: { redirectTo: string }) {
  return (
    <div className="space-y-3">
      <a
        href={`/sign-up?redirect_url=${encodeURIComponent(redirectTo)}`}
        className="flex w-full items-center justify-center rounded-full bg-pen px-8 py-3.5 text-base font-bold text-white shadow-lifted hover:bg-pen-deep"
      >
        Save my progress — sign up free
      </a>
      <p className="text-center text-xs text-ink-faint">
        Already have an account?{" "}
        <a
          href={`/sign-in?redirect_url=${encodeURIComponent(redirectTo)}`}
          className="font-bold text-pen hover:text-pen-deep"
        >
          Sign in
        </a>
      </p>
    </div>
  );
}

export default function OnboardingSavePage() {
  const router = useRouter();
  const [students, setStudents] = useState<GradedOnboardingStudent[] | null>(null);
  const clerkConfigured = hasClerkPublishableKey();

  useEffect(() => {
    fireEvent(ONBOARDING_EVENTS.SAVE_PROGRESS);
    const vault = getVault();
    if (!vault) {
      router.replace("/onboarding/hook");
      return;
    }
    const graded = normalizeStudents(vault);
    if (graded.length === 0) {
      const step = getResumeStep(vault);
      router.replace(`/onboarding/${step}`);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStudents(graded);
  }, [router]);

  if (!students) {
    return (
      <OnboardingShell step={6} backHref="/onboarding/result">
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-pen border-t-transparent" />
        </div>
      </OnboardingShell>
    );
  }

  const totalEarned = students.reduce((sum, s) => sum + s.grade.marksEarned, 0);
  const totalMax = students.reduce((sum, s) => sum + s.grade.maxMarks, 0);

  return (
    <OnboardingShell step={6} backHref="/onboarding/result">
      <div className="text-center">
        <p className="font-hand text-2xl text-pen">One last thing</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Save your graded class
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-ink-soft">
          Don&rsquo;t lose this — sign up with email, Google, or Apple to keep your progress.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <Card>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">
            {students.length} student{students.length === 1 ? "" : "s"} graded
          </p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="font-hand -rotate-2 text-4xl font-bold text-pen">
              {totalEarned}/{totalMax}
            </p>
            <span className="rounded-full bg-moss-wash px-2.5 py-0.5 text-xs font-bold text-moss-deep ring-1 ring-moss/30">
              Graded
            </span>
          </div>
        </Card>

        <div className="pt-2">
          {clerkConfigured ? (
            <AuthMethodPanel
              redirectTo="/onboarding-sync"
              intent="sign-up"
              onStarted={() => fireEvent(ONBOARDING_EVENTS.AUTH_STARTED)}
            />
          ) : (
            <AuthFallback redirectTo="/onboarding-sync" />
          )}
        </div>
      </div>
    </OnboardingShell>
  );
}
