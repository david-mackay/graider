"use client";

import Link from "next/link";
import StudentAuthEntry from "@/components/marketing/StudentAuthEntry";

type StudentLandingPageProps = {
  inviteCode?: string;
};

const BENEFITS = [
  {
    title: "Calm, focused testing",
    desc: "A clean writing space without the noise — so you can concentrate on what you know.",
  },
  {
    title: "Timers you can trust",
    desc: "When a test is timed, you’ll always see how much time you have left, right where you’re working.",
  },
  {
    title: "Feedback that helps you improve",
    desc: "Get marks and comments from your teacher on your own work — clear, personal, and useful next time.",
  },
];

export default function StudentLandingPage({ inviteCode }: StudentLandingPageProps) {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] overflow-hidden">
      <section className="relative">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 pb-16 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-rise text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-pen">
              {inviteCode ? "Student invite" : "For students"}
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Your place to take the test.
            </h1>
            <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-ink-soft lg:mx-0">
              Graider is a comfortable, accurate testing platform — sit your assessments with
              confidence, then get personalized feedback from your teacher that helps you grow.
            </p>
            <div className="mx-auto mt-8 max-w-md rounded-2xl border border-line bg-paper p-5 text-left shadow-paper lg:mx-0">
              <p className="mb-3 text-sm font-semibold text-ink">Join your class</p>
              <StudentAuthEntry initialCode={inviteCode ?? ""} />
            </div>
            <p className="mt-5 text-xs text-ink-faint">
              Teachers?{" "}
              <Link href="/" className="font-semibold text-pen underline decoration-line underline-offset-2">
                Go to the teacher home
              </Link>
            </p>
          </div>

          <div className="animate-rise-slow space-y-5">
            {BENEFITS.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-line bg-cream/40 px-5 py-4 text-left"
              >
                <h2 className="font-display text-lg font-semibold text-ink">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line/70 bg-paper/70">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            How it works for you
          </h2>
          <ol className="mt-8 space-y-5 text-left sm:mx-auto sm:max-w-lg">
            <li className="flex gap-4">
              <span className="font-display text-2xl font-semibold text-pen">01</span>
              <div>
                <p className="font-semibold text-ink">Get an invite code from your teacher</p>
                <p className="mt-1 text-sm text-ink-soft">
                  It’s personal to you — enter it when you sign up or sign in.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-display text-2xl font-semibold text-pen">02</span>
              <div>
                <p className="font-semibold text-ink">Take your tests when they’re open</p>
                <p className="mt-1 text-sm text-ink-soft">
                  See what’s available, watch the clock if there’s a time limit, and submit when you’re ready.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-display text-2xl font-semibold text-pen">03</span>
              <div>
                <p className="font-semibold text-ink">Review your results</p>
                <p className="mt-1 text-sm text-ink-soft">
                  When your teacher releases grades, you’ll see your marks and their comments on your work.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
