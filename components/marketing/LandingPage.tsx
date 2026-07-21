"use client";

import Link from "next/link";
import ClerkAuthButton from "@/components/shared/ClerkAuthButton";
import VaultResumeGate from "@/components/marketing/VaultResumeGate";
import { setSignupIntent } from "@/lib/signup-intent";

/** A miniature marked paper, built in CSS — the hero's visual anchor. */
function GradedPaper() {
  return (
    <div className="relative mx-auto h-72 w-60 sm:h-80 sm:w-64" aria-hidden="true">
      <div className="absolute inset-0 -rotate-6 rounded-lg border border-line bg-cream-deep shadow-paper" />
      <div className="absolute inset-0 rotate-3 rounded-lg border border-line bg-cream shadow-paper" />

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
    title: "Drop in your test",
    note: "answer bank included",
    desc: "Upload the test and your answer key. Graider pulls questions and the bank automatically — no retyping the whole paper by hand.",
  },
  {
    n: "02",
    title: "Grade against your rubric",
    note: "your standards, not AI vibes",
    desc: "Marks and feedback come from the key and rubric you provide. This is not an LLM freestyling opinions about student work.",
  },
  {
    n: "03",
    title: "Snap the stack",
    note: "camera or photo library",
    desc: "Photograph the pile. Graider matches pages to students on your roster. You confirm once, then it grades the lot.",
  },
  {
    n: "04",
    title: "Hand it back your way",
    note: "PDF, email, your call",
    desc: "Toggle feedback on or off before you release. Share a marked PDF immediately, or email results with each student's address already filled in.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] overflow-hidden">
      <VaultResumeGate />

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
              Upload your test and answer key, photograph the stack, and get
              marks against <em className="not-italic font-semibold text-ink">your</em> rubric —
              then hand back a PDF or email with feedback you control.
            </p>
            <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row lg:justify-start sm:justify-center">
              <Link
                href="/onboarding/hook"
                onClick={() => setSignupIntent("teacher")}
                className="inline-flex cursor-pointer items-center justify-center rounded-full bg-pen px-8 py-3.5 text-base font-bold text-white shadow-lifted transition-all duration-150 hover:bg-pen-deep active:scale-[0.97]"
              >
                Grade your first paper
              </Link>
              <ClerkAuthButton authMode="sign-in" mode="modal" fallbackRedirectUrl="/t">
                <button
                  type="button"
                  onClick={() => setSignupIntent("teacher")}
                  className="cursor-pointer text-sm font-bold text-ink-soft underline decoration-line underline-offset-4 transition-colors duration-150 hover:text-pen"
                >
                  Teacher sign in
                </button>
              </ClerkAuthButton>
            </div>
            <p className="mt-4 text-xs text-ink-faint">
              Free to try — no card, no setup, two minutes.{" "}
              <Link href="/student" className="font-semibold text-pen underline decoration-line underline-offset-2">
                Students join here
              </Link>
            </p>
          </div>

          <div className="animate-rise-slow">
            <GradedPaper />
          </div>
        </div>
      </section>

      <section className="border-t border-line/70 bg-paper/60">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-ink-faint">
            How it works
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-center font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Your key. Your stack. Their marked papers — tonight.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-base leading-relaxed text-ink-soft">
            Built for teachers who already know how they want work marked, and just need the Sunday pile gone.
          </p>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-12">
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

      <section className="bg-ink">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="font-hand text-2xl text-gold">Sunday evening, 7pm. A stack of 28 papers.</p>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-paper">
            Done before your coffee is.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-paper/70">
            Import your test, grade against your rubric, then toggle feedback and send the PDF —
            or email each student with their address already filled in.
          </p>
          <div className="mt-9">
            <Link
              href="/onboarding/hook"
              onClick={() => setSignupIntent("teacher")}
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
