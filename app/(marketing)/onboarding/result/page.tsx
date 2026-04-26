"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import SocialProofCard from "@/components/marketing/SocialProofCard";
import { Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import { IconSparkle } from "@/components/shared/icons";
import { getResumeStep, getVault, setVault } from "@/lib/onboarding/vault";
import type { OnboardingSampleGrade } from "@/lib/onboarding/types";
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

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

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

    if (!vault.answerKey || !vault.studentPaper) {
      router.replace("/onboarding/upload");
      return;
    }

    const { answerKey, studentPaper } = vault;
    const formData = new FormData();
    const blob = base64ToBlob(studentPaper.base64, studentPaper.mimeType);
    formData.append("image", blob, studentPaper.filename || "paper.png");
    formData.append(
      "answerKey",
      JSON.stringify({
        prompt: answerKey.prompt,
        correctAnswer: answerKey.correctAnswer,
        marks: answerKey.marks,
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

  return (
    <OnboardingShell step={5} backHref="/onboarding/upload" backLabel="Re-upload">
      <div className="text-center">
        <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-xl shadow-indigo-300/40">
          <IconSparkle className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-indigo-950 sm:text-4xl">
          Sample grade &mdash; your first paper
        </h1>
      </div>

      <div className="mt-8 space-y-5">
        {state.kind === "loading" ? (
          <Card className="text-center py-12">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <p className="text-sm font-medium text-indigo-400">
              Reading your student&rsquo;s handwriting&hellip;
            </p>
          </Card>
        ) : null}

        {(state.kind === "ready" || state.kind === "soft-fail") ? (
          <Card>
            <div className="flex flex-col items-center text-center">
              <div className="inline-flex items-baseline gap-1">
                <span className="text-5xl font-extrabold text-indigo-600">{state.grade.marksEarned}</span>
                <span className="text-xl font-semibold text-slate-400">/ {state.grade.maxMarks}</span>
              </div>
              {state.grade.feedback ? (
                <p className="mt-3 max-w-md text-sm leading-relaxed text-indigo-950">
                  {state.grade.feedback}
                </p>
              ) : null}
            </div>

            {state.grade.ocrAnswerText ? (
              <div className="mt-5 border-t border-indigo-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What we read</p>
                <pre className="mt-1.5 whitespace-pre-wrap rounded-md border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-xs leading-relaxed text-slate-700">
                  {state.grade.ocrAnswerText}
                </pre>
              </div>
            ) : null}

            {state.kind === "soft-fail" ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
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
