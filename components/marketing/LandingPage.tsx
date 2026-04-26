"use client";

import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import VaultResumeGate from "@/components/marketing/VaultResumeGate";

export default function LandingPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] overflow-hidden">
      <VaultResumeGate />
      {/* Hero */}
      <div className="relative bg-gradient-to-b from-indigo-50/80 via-white to-violet-50/40">
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-br from-indigo-200/40 via-violet-200/30 to-transparent blur-3xl" />

        <div className="relative mx-auto max-w-3xl px-4 pt-24 pb-16 text-center">
          <div className="mx-auto mb-8 inline-flex h-18 w-18 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-xl shadow-indigo-300/40">
            <svg className="h-9 w-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
          </div>

          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-200/60">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
            Powered by AI
          </p>

          <h1 className="text-5xl font-extrabold tracking-tight text-indigo-950 sm:text-6xl">
            Meet{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              gr<span className="font-black">AI</span>der
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-500 leading-relaxed sm:text-xl">
            The AI-powered grading assistant that marks tests in seconds.
            Build question banks, collect submissions, and let AI deliver instant grades and feedback.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/onboarding/hook"
              className="cursor-pointer w-full sm:w-auto rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-300/40 hover:from-indigo-700 hover:to-violet-700 transition-all duration-200 text-center"
            >
              Show me how it works
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-400">No credit card required</p>
        </div>
      </div>

      {/* How it works */}
      <div className="mx-auto max-w-4xl px-4 pb-8 pt-4">
        <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-indigo-400">How it works</p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Build",
              desc: "Create classes, invite students, and build question banks with answer keys.",
              gradient: "from-indigo-500 to-indigo-600",
              iconBg: "bg-indigo-50",
              icon: (
                <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
              ),
            },
            {
              step: "2",
              title: "Collect",
              desc: "Students submit answers online or teachers upload handwritten sheets via photo.",
              gradient: "from-violet-500 to-violet-600",
              iconBg: "bg-violet-50",
              icon: (
                <svg className="h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
                </svg>
              ),
            },
            {
              step: "3",
              title: "AI Grades",
              desc: "One click to batch-grade every submission with detailed marks and personalized feedback.",
              gradient: "from-emerald-500 to-emerald-600",
              iconBg: "bg-emerald-50",
              icon: (
                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
              ),
            },
          ].map((item) => (
            <div key={item.step} className="group relative rounded-xl border border-indigo-100 bg-white p-6 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all duration-200">
              <div className="mb-4 flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${item.gradient} text-xs font-bold text-white shadow-sm`}>
                  {item.step}
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.iconBg}`}>
                  {item.icon}
                </div>
              </div>
              <p className="text-base font-semibold text-indigo-950">{item.title}</p>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-8 py-12 shadow-xl shadow-indigo-300/30">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Stop grading by hand
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-indigo-100">
            Join teachers who save hours every week with AI-powered grading. Set up your first class in under a minute.
          </p>
          <div className="mt-8">
            <SignInButton mode="modal">
              <button
                type="button"
                className="cursor-pointer rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 transition-colors duration-150"
              >
                Start grading with AI
              </button>
            </SignInButton>
          </div>
        </div>
      </div>
    </div>
  );
}
