"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import {
  FormField,
  btnPrimary,
  inputClass,
} from "@/components/shared/ui";
import { IconClipboard } from "@/components/shared/icons";
import { getVault, setVault } from "@/lib/onboarding/vault";

const DEFAULT_PROMPT =
  "Name two functions of the mitochondria.";
const DEFAULT_CORRECT_ANSWER =
  "Mitochondria produce ATP via cellular respiration, and they regulate cellular metabolism / signal apoptosis.";

export default function OnboardingAnswerKeyPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [marks, setMarks] = useState(5);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from vault if user is returning to edit.
  useEffect(() => {
    const vault = getVault();
    if (vault?.answerKey) {
      setPrompt(vault.answerKey.prompt);
      setCorrectAnswer(vault.answerKey.correctAnswer);
      setMarks(vault.answerKey.marks);
    }
  }, []);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmedPrompt = prompt.trim();
    const trimmedAnswer = correctAnswer.trim();
    if (!trimmedPrompt) {
      setError("Add a question prompt so the AI knows what to grade.");
      return;
    }
    if (!trimmedAnswer) {
      setError("Add the correct answer so the AI has something to compare against.");
      return;
    }
    if (!Number.isInteger(marks) || marks <= 0) {
      setError("Marks must be a positive whole number.");
      return;
    }
    setVault({
      answerKey: {
        prompt: trimmedPrompt,
        correctAnswer: trimmedAnswer,
        marks,
      },
    });
    router.push("/onboarding/upload");
  }

  return (
    <OnboardingShell step={3} backHref="/onboarding/capabilities">
      <div className="text-center">
        <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-xl shadow-indigo-300/40">
          <IconClipboard className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-indigo-950 sm:text-4xl">
          First, give me the answer key for one question.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-slate-500">
          This is what AI will grade against. The more specific, the better.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <FormField
          label="Question prompt"
          hint="What you asked the student."
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder={DEFAULT_PROMPT}
            required
          />
        </FormField>

        <FormField
          label="Correct answer"
          hint="The model answer. Be specific — the AI uses this verbatim."
        >
          <textarea
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            rows={4}
            className={inputClass}
            placeholder={DEFAULT_CORRECT_ANSWER}
            required
          />
        </FormField>

        <FormField label="Marks" hint="How much this question is worth.">
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={marks}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10);
              setMarks(Number.isFinite(next) ? next : 0);
            }}
            className={`${inputClass} max-w-32`}
            required
          />
        </FormField>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        <div className="pt-2">
          <button type="submit" className={`${btnPrimary} w-full justify-center py-3`}>
            Continue to upload
          </button>
        </div>
      </form>
    </OnboardingShell>
  );
}
