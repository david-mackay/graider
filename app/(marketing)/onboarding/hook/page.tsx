"use client";

import { useEffect } from "react";
import Link from "next/link";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import { ONBOARDING_EVENTS, fireEvent } from "@/lib/onboarding/funnel-events";

export default function OnboardingHookPage() {
  useEffect(() => {
    fireEvent(ONBOARDING_EVENTS.EMOTIONAL_HOOK);
  }, []);

  return (
    <OnboardingShell step={1}>
      <div className="text-center">
        <p className="font-hand text-2xl text-pen">Sunday, 7:42pm</p>

        <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl">
          You&rsquo;re a great teacher. The papers just get in the way.
        </h1>

        <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-ink-soft sm:text-lg">
          You spend evenings grading. Not because you don&rsquo;t care about
          your students &mdash; because grading 30 papers takes 3 hours.
        </p>

        <div className="mt-10">
          <Link
            href="/onboarding/capabilities"
            className="inline-flex cursor-pointer items-center justify-center rounded-full bg-pen px-8 py-3.5 text-base font-bold text-white shadow-lifted transition-all duration-150 hover:bg-pen-deep active:scale-[0.97]"
          >
            Show me how
          </Link>
        </div>

        <p className="mt-4 text-xs text-ink-faint">Takes about 60 seconds</p>
      </div>
    </OnboardingShell>
  );
}
