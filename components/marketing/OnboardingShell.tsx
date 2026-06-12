"use client";

import Link from "next/link";

type OnboardingShellProps = {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
};

const TOTAL_STEPS = 6;

export default function OnboardingShell({
  step,
  backHref,
  backLabel = "Back",
  children,
}: OnboardingShellProps) {
  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <div className="mx-auto w-full max-w-xl px-4 pt-8 pb-20 sm:pt-12">
        <ProgressDots current={step} />

        {backHref ? (
          <div className="mt-6">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft hover:text-pen transition-colors duration-150"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
              {backLabel}
            </Link>
          </div>
        ) : null}

        <div className="mt-6 animate-rise sm:mt-10">{children}</div>
      </div>
    </div>
  );
}

function ProgressDots({ current }: { current: number }) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={TOTAL_STEPS}
      aria-label={`Step ${current} of ${TOTAL_STEPS}`}
    >
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const stepNumber = i + 1;
        const isCompleted = stepNumber < current;
        const isCurrent = stepNumber === current;
        return (
          <span
            key={stepNumber}
            className={
              isCurrent
                ? "h-2 w-8 rounded-full bg-pen transition-all duration-250"
                : isCompleted
                  ? "h-2 w-2 rounded-full bg-pen/70 transition-all duration-250"
                  : "h-2 w-2 rounded-full bg-line transition-all duration-250"
            }
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}
