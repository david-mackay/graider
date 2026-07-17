"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import SocialProofCard from "@/components/marketing/SocialProofCard";
import { Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import { getResumeStep, getVault, setVault } from "@/lib/onboarding/vault";
import { ONBOARDING_EVENTS, fireEvent } from "@/lib/onboarding/funnel-events";
import { hasAnswerKey, normalizeAnswerKeys, type OnboardingSampleGrade } from "@/lib/onboarding/types";
import type { SampleGradeResponse } from "@/lib/types";

type ResultState =
  | { kind: "loading" }
  | { kind: "ready"; grade: OnboardingSampleGrade }
  | { kind: "soft-fail"; grade: OnboardingSampleGrade }
  | { kind: "rate-limited"; message: string }
  | { kind: "error"; message: string };

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || "image/png" });
}

export default function OnboardingResultPage() {
  const router = useRouter();
  const [state, setState] = useState<ResultState>({ kind: "loading" });
  const ranRef = useRef(false);

  // The effect drives the entire fetch lifecycle from a localStorage read,
  // so setState calls in it are intentional. Suppress the React 19 rule
  // for the body of this effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    fireEvent(ONBOARDING_EVENTS.FIRST_GRADE_RENDERED);

    const vault = getVault();
    if (!vault) {
      router.replace("/onboarding/hook");
      return;
    }

    const step = getResumeStep(vault);
    if (step !== "result" && step !== "save" && step !== "completed") {
      router.replace(`/onboarding/${step}`);
      return;
    }

    if (vault.sampleGrade) {
      const isSoftFail = vault.sampleGrade.marksEarned === 0 && vault.sampleGrade.ocrAnswerText === "";
      setState({ kind: isSoftFail ? "soft-fail" : "ready", grade: vault.sampleGrade });
      return;
    }

    if (!hasAnswerKey(vault) || !vault.studentPaper) {
      router.replace("/onboarding/upload");
      return;
    }

    const answerKeys = normalizeAnswerKeys(vault);
    const { studentPaper } = vault;
    const formData = new FormData();
    const blob = base64ToBlob(studentPaper.base64, studentPaper.mimeType);
    formData.append("image", blob, studentPaper.filename || "paper.png");
    formData.append("answerKeys", JSON.stringify(answerKeys));
    formData.append(
      "answerKey",
      JSON.stringify({
        prompt: answerKeys[0].prompt,
        correctAnswer: answerKeys[0].correctAnswer,
        marks: answerKeys[0].marks,
      }),
    );

    void (async () => {
      try {
        const res = await fetch("/api/onboarding/sample-grade", { method: "POST", body: formData });
        if (res.status === 429) {
          setState({
            kind: "rate-limited",
            message: "We've hit our free demo quota. Sign up for unlimited grading.",
          });
          return;
        }
        const payload = (await res.json()) as SampleGradeResponse & { error?: string };
        if (!res.ok) {
          setState({
            kind: "error",
            message: payload.error ?? "We're having trouble grading right now — please try again.",
          });
          return;
        }
        const grade: OnboardingSampleGrade = {
          marksEarned: payload.marksEarned,
          maxMarks: payload.maxMarks,
          feedback: payload.feedback,
          ocrAnswerText: payload.ocrAnswerText,
          questions: payload.questions,
        };
        setVault({ sampleGrade: grade, completedAt: new Date().toISOString() });
        const isSoftFail = grade.marksEarned === 0 && grade.ocrAnswerText === "";
        setState({ kind: isSoftFail ? "soft-fail" : "ready", grade });
      } catch (err) {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "We're having trouble grading right now — please try again.",
        });
      }
    })();
  }, [router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <OnboardingShell step={5} backHref="/onboarding/upload" backLabel="Re-upload">
      <div className="text-center">
        <p className="font-hand text-2xl text-pen">Marked and handed back</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Your first graded paper
        </h1>
      </div>

      <div className="mt-8 space-y-5">
        {state.kind === "loading" ? (
          <Card className="text-center py-12">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-pen border-t-transparent" />
            <p className="font-hand text-xl text-ink-soft">
              Reading your student&rsquo;s handwriting&hellip;
            </p>
          </Card>
        ) : null}

        {(state.kind === "ready" || state.kind === "soft-fail") ? (
          <Card className="animate-rise">
            <div className="flex flex-col items-center text-center">
              <p className="font-hand -rotate-3 text-6xl font-bold text-pen">
                {state.grade.marksEarned}/{state.grade.maxMarks}
              </p>
              {state.grade.feedback ? (
                <p className="mt-4 max-w-md font-hand text-2xl leading-snug text-pen-deep">
                  {state.grade.feedback}
                </p>
              ) : null}
            </div>

            {state.grade.questions && state.grade.questions.length > 1 ? (
              <div className="mt-6 space-y-3 border-t border-line pt-4 text-left">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">
                  Per question
                </p>
                {state.grade.questions.map((q, index) => (
                  <div key={`${index}-${q.prompt.slice(0, 20)}`} className="rounded-xl border border-line bg-cream px-3.5 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold text-ink line-clamp-2">
                        Q{index + 1}. {q.prompt}
                      </p>
                      <p className="shrink-0 font-hand text-lg font-bold text-pen">
                        {q.marksEarned}/{q.maxMarks}
                      </p>
                    </div>
                    {q.feedback ? (
                      <p className="mt-1 text-xs leading-relaxed text-ink-soft">{q.feedback}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {state.grade.ocrAnswerText ? (
              <div className="mt-6 border-t border-line pt-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">What we read</p>
                <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-line bg-cream px-3.5 py-2.5 font-sans text-xs leading-relaxed text-ink-soft">
                  {state.grade.ocrAnswerText}
                </pre>
              </div>
            ) : null}

            {state.kind === "soft-fail" ? (
              <p className="mt-4 rounded-xl border border-marigold/30 bg-marigold-wash px-3.5 py-2.5 text-xs font-bold text-marigold-deep">
                We couldn&rsquo;t read the answer clearly. Try a clearer photo for a real grade, or continue anyway.
              </p>
            ) : null}
          </Card>
        ) : null}

        {state.kind === "rate-limited" ? (
          <Card className="border-amber-200 bg-amber-50/40">
            <p className="text-sm font-semibold text-amber-900">{state.message}</p>
            <p className="mt-1 text-xs text-amber-800">
              Sign up to keep grading without limits.
            </p>
          </Card>
        ) : null}

        {state.kind === "error" ? (
          <Card className="border-red-200 bg-red-50/40">
            <p className="text-sm font-semibold text-red-800">Something went wrong</p>
            <p className="mt-1 text-xs text-red-700">{state.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/onboarding/upload" className={`${btnSecondary} text-xs`}>
                Try a clearer photo
              </Link>
              <Link href="/onboarding/save" className={`${btnPrimary} text-xs`}>
                Continue anyway
              </Link>
            </div>
          </Card>
        ) : null}

        {state.kind !== "loading" && state.kind !== "error" ? (
          <SocialProofCard />
        ) : null}

        {state.kind === "ready" || state.kind === "soft-fail" ? (
          <div className="text-center">
            <Link
              href="/onboarding/save"
              className={`${btnPrimary} w-full justify-center py-3 sm:w-auto`}
            >
              Save my first graded test
            </Link>
            <p className="mt-3 text-xs text-slate-400">
              Re-uploading will rerun the demo grade.
            </p>
          </div>
        ) : null}

        {state.kind === "rate-limited" ? (
          <div className="text-center">
            <Link
              href="/onboarding/save"
              className={`${btnPrimary} w-full justify-center py-3 sm:w-auto`}
            >
              Sign up to keep grading
            </Link>
          </div>
        ) : null}
      </div>
    </OnboardingShell>
  );
}
