"use client";

import { useEffect } from "react";
import Link from "next/link";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import { Card } from "@/components/shared/ui";
import { IconSparkle } from "@/components/shared/icons";
import { ONBOARDING_EVENTS, fireEvent } from "@/lib/onboarding/funnel-events";

type Capability = {
  emoji: string;
  verb: string;
  example: string;
};

const CAPABILITIES: Capability[] = [
  {
    emoji: "📸",
    verb: "Scan",
    example: "Snap a photo of Maya's handwritten test.",
  },
  {
    emoji: "⚡",
    verb: "Grade",
    example:
      "AI compares her answer to your key — 7/10, 'Missed the second mitochondria function.'",
  },
  {
    emoji: "📊",
    verb: "Review",
    example: "See exactly where the class struggled before next lesson.",
  },
];

export default function OnboardingCapabilitiesPage() {
  useEffect(() => {
    fireEvent(ONBOARDING_EVENTS.CAPABILITIES);
  }, []);

  return (
    <OnboardingShell step={2} backHref="/onboarding/hook">
      <div className="text-center">
        <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-xl shadow-indigo-300/40">
          <IconSparkle className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-indigo-950 sm:text-4xl">
          That&rsquo;s where{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            gr<span className="font-black">AI</span>der
          </span>{" "}
          comes in.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-slate-500">
          Three things it does in the background while you teach.
        </p>
      </div>

      <ul className="mt-8 space-y-4">
        {CAPABILITIES.map((cap) => (
          <li key={cap.verb}>
            <Card className="hover:border-indigo-200 transition-colors duration-150">
              <div className="flex items-start gap-4">
                <span
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-2xl"
                  aria-hidden="true"
                >
                  {cap.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-indigo-950">
                    {cap.verb}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    {cap.example}
                  </p>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <div className="mt-10 text-center">
        <Link
          href="/onboarding/answer-key"
          className="cursor-pointer inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-300/40 hover:from-indigo-700 hover:to-violet-700 transition-all duration-200"
        >
          Try it on one paper
        </Link>
        <p className="mt-3 text-xs text-slate-400">
          No sign up &mdash; we&rsquo;ll grade a single paper for you.
        </p>
      </div>
    </OnboardingShell>
  );
}
