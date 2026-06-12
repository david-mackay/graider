"use client";

import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import VaultResumeGate from "@/components/marketing/VaultResumeGate";

/** A miniature marked paper, built in CSS — the hero's visual anchor. */
function GradedPaper() {
  return (
    <div className="relative mx-auto h-72 w-60 sm:h-80 sm:w-64" aria-hidden="true">
      {/* Sheets underneath */}
      <div className="absolute inset-0 -rotate-6 rounded-lg border border-line bg-cream-deep shadow-paper" />
      <div className="absolute inset-0 rotate-3 rounded-lg border border-line bg-cream shadow-paper" />

      {/* Top sheet */}
      <div className="absolute inset-0 -rotate-1 overflow-hidden rounded-lg border border-line bg-paper shadow-card">
        <div className="flex h-full flex-col px-5 py-4">
          <div className="flex items-baseline justify-between">
            <p className="font-hand text-xl text-ink-soft">Maya P.</p>
            <p className="font-hand text-3xl font-bold text-pen -rotate-6">9/10</p>
          </div>

          <div className="mt-3 space-y-3.5">
            {[true, true, false, true].map((correct, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-hand text-base leading-none text-pen">
                  {correct ? "✓" : "✗"}
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>
            ))}
          </div>

          <p className="mt-auto font-hand text-lg leading-snug text-pen -rotate-1">
            Lovely working on Q3 —<br />watch the units!
          </p>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Snap the stack",
    note: "any phone camera works",
    desc: "Take photos of the whole pile of handwritten papers and drop them in. No scanner, no per-page fuss.",
  },
  {
    n: "02",
    title: "Names match themselves",
    note: "you just confirm",
    desc: "Graider reads each page, finds the student's name, and pairs it with your class roster. You confirm with one glance.",
  },
  {
    n: "03",
    title: "The red pen does the rest",
    note: "marks + feedback",
    desc: "Every answer is graded against your answer key, with per-question marks and feedback written like margin notes.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] overflow-hidden">
      <VaultResumeGate />

      {/* Hero */}
      <section className="relative">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-rise text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-pen">
              For teachers who grade by hand
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              The stack grades itself.
            </h1>
            <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-ink-soft lg:mx-0">
              Photograph the pile of papers. Graider reads every page, matches it
              to a student, and marks it with feedback — in one pass.
            </p>
            <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row lg:justify-start sm:justify-center">
              <Link
                href="/onboarding/hook"
                className="inline-flex cursor-pointer items-center justify-center rounded-full bg-pen px-8 py-3.5 text-base font-bold text-white shadow-lifted transition-all duration-150 hover:bg-pen-deep active:scale-[0.97]"
              >
                Grade a sample paper
              </Link>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="cursor-pointer text-sm font-bold text-ink-soft underline decoration-line underline-offset-4 transition-colors duration-150 hover:text-pen"
                >
                  I already have an account
                </button>
              </SignInButton>
            </div>
            <p className="mt-4 text-xs text-ink-faint">
              Free to try — no card, no setup, two minutes.
            </p>
          </div>

          <div className="animate-rise-slow">
            <GradedPaper />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-line/70 bg-paper/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-ink-faint">
            How it works
          </p>
          <div className="mt-12 grid gap-12 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((step) => (
              <div key={step.n}>
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-3xl font-semibold text-pen">{step.n}</span>
                  <span className="font-hand text-lg text-ink-faint">{step.note}</span>
                </div>
                <h3 className="mt-3 font-display text-xl font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-ink">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="font-hand text-2xl text-gold">Sunday evening, 7pm. A stack of 28 papers.</p>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-paper">
            Done before your coffee is.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-paper/70">
            Set up a class, photograph the stack, and hand back marked papers
            with real feedback — tomorrow morning.
          </p>
          <div className="mt-9">
            <Link
              href="/onboarding/hook"
              className="inline-flex cursor-pointer items-center justify-center rounded-full bg-pen px-8 py-3.5 text-base font-bold text-white shadow-lifted transition-all duration-150 hover:bg-pen-deep active:scale-[0.97]"
            >
              Try it on one paper
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
