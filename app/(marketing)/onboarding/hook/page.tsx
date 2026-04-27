"use client";

import { useEffect } from "react";
import Link from "next/link";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import { IconSparkle } from "@/components/shared/icons";
import { ONBOARDING_EVENTS, fireEvent } from "@/lib/onboarding/funnel-events";

export default function OnboardingHookPage() {
  useEffect(() => {
    fireEvent(ONBOARDING_EVENTS.EMOTIONAL_HOOK);
  }, []);

  return (
    <OnboardingShell step={1}>
      <div className="text-center">
        <div className="mx-auto mb-8 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-xl shadow-indigo-300/40">
          <IconSparkle className="h-8 w-8 text-white" />
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-indigo-950 sm:text-5xl">
          You&rsquo;re a great teacher.{" "}
          <span className="text-indigo-600">
            Stacks of papers just get in the way.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-slate-500 sm:text-lg">
          You spend evenings grading. Not because you don&rsquo;t care about
          your students &mdash; because grading 30 papers takes 3 hours.
        </p>

        <div className="mt-10">
          <Link
            href="/onboarding/capabilities"
            className="cursor-pointer inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-300/40 hover:from-indigo-700 hover:to-violet-700 transition-all duration-200"
          >
            Show me how
          </Link>
        </div>

        <p className="mt-4 text-xs text-slate-400">Takes about 60 seconds</p>
      </div>
    </OnboardingShell>
  );
}
