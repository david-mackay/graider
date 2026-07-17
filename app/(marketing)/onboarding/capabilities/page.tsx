"use client";

import { useEffect } from "react";
import Link from "next/link";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import { Wordmark } from "@/components/shared/Brand";
import { Card } from "@/components/shared/ui";
import { IconCamera, IconPen, IconStack } from "@/components/shared/icons";

import { ONBOARDING_EVENTS, fireEvent } from "@/lib/onboarding/funnel-events";

type Capability = {
  Icon: (props: { className?: string }) => React.ReactNode;
  verb: string;
  example: string;
};

const CAPABILITIES: Capability[] = [
  {
    Icon: IconStack,
    verb: "Import",
    example:
      "Upload your test and answer bank. Questions and the key land automatically — you are not rebuilding the paper from scratch.",
  },
  {
    Icon: IconPen,
    verb: "Grade your way",
    example:
      "Every mark is checked against your rubric and answer key. Reliable grading, not an AI giving its opinions.",
  },
  {
    Icon: IconCamera,
    verb: "Hand it back",
    example:
      "Toggle feedback on or off, share a PDF immediately, or email results with each student's address already filled in.",
  },
];

export default function OnboardingCapabilitiesPage() {
  useEffect(() => {
    fireEvent(ONBOARDING_EVENTS.CAPABILITIES);
  }, []);

  return (
    <OnboardingShell step={2} backHref="/onboarding/hook">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          That&rsquo;s where <Wordmark className="text-[1em]" /> comes in.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-ink-soft">
          Bring the test you already wrote. Grade against the key you trust. Hand papers back tonight.
        </p>
      </div>

      <ul className="mt-8 space-y-4">
        {CAPABILITIES.map((cap) => (
          <li key={cap.verb}>
            <Card className="transition-colors duration-150 hover:border-ink-faint/50">
              <div className="flex items-start gap-4">
                <span
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-pen-wash"
                  aria-hidden="true"
                >
                  <cap.Icon className="h-6 w-6 text-pen" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold text-ink">
                    {cap.verb}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
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
          className="inline-flex cursor-pointer items-center justify-center rounded-full bg-pen px-8 py-3.5 text-base font-bold text-white shadow-lifted transition-all duration-150 hover:bg-pen-deep active:scale-[0.97]"
        >
          Try it on one paper
        </Link>
        <p className="mt-3 text-xs text-ink-faint">
          No sign up &mdash; we&rsquo;ll grade a single paper for you.
        </p>
      </div>
    </OnboardingShell>
  );
}
