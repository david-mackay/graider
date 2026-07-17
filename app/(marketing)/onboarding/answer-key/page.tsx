"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import {
  FormField,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/components/shared/ui";
import { getVault, setVault } from "@/lib/onboarding/vault";
import { ONBOARDING_EVENTS, fireEvent } from "@/lib/onboarding/funnel-events";
import {
  answerKeyVaultUpdate,
  normalizeAnswerKeys,
  type OnboardingAnswerKey,
} from "@/lib/onboarding/types";

const DEFAULT_PROMPT = "Name two functions of the mitochondria.";
const DEFAULT_CORRECT_ANSWER =
  "Mitochondria produce ATP via cellular respiration, and they regulate cellular metabolism / signal apoptosis.";

type ParseResponse = {
  questions?: OnboardingAnswerKey[];
  truncated?: boolean;
  totalFound?: number;
  error?: string;
};

export default function OnboardingAnswerKeyPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"choose" | "manual" | "preview">("choose");
  const [keys, setKeys] = useState<OnboardingAnswerKey[]>([]);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [marks, setMarks] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fireEvent(ONBOARDING_EVENTS.ANSWER_KEY);
    const vault = getVault();
    const existing = normalizeAnswerKeys(vault);
    if (existing.length > 0) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setKeys(existing);
      setMode(vault?.answerKeySource === "manual" && existing.length === 1 ? "manual" : "preview");
      if (existing.length === 1) {
        setPrompt(existing[0].prompt);
        setCorrectAnswer(existing[0].correctAnswer);
        setMarks(existing[0].marks);
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);

  async function onPickPdf(file: File | null) {
    if (!file) return;
    setError(null);
    setBusy(true);
    setPdfName(file.name);
    try {
      const formData = new FormData();
      formData.append("pdf", file, file.name);
      const res = await fetch("/api/onboarding/parse-answer-key", {
        method: "POST",
        body: formData,
      });
      const payload = (await res.json()) as ParseResponse;
      if (!res.ok) {
        throw new Error(payload.error ?? "Could not read that PDF.");
      }
      const questions = payload.questions ?? [];
      if (questions.length === 0) {
        throw new Error("No questions found in that PDF.");
      }
      setKeys(questions);
      setTruncated(Boolean(payload.truncated));
      setMode("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that PDF.");
      setPdfName(null);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function continueWithKeys(nextKeys: OnboardingAnswerKey[], source: "pdf" | "manual") {
    setVault(answerKeyVaultUpdate(nextKeys, source));
    router.push("/onboarding/upload");
  }

  function onManualSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmedPrompt = prompt.trim();
    const trimmedAnswer = correctAnswer.trim();
    if (!trimmedPrompt) {
      setError("Add a question prompt so Graider knows what to grade.");
      return;
    }
    if (!trimmedAnswer) {
      setError("Add the correct answer so Graider has something to compare against.");
      return;
    }
    if (!Number.isInteger(marks) || marks <= 0) {
      setError("Marks must be a positive whole number.");
      return;
    }
    continueWithKeys(
      [{ prompt: trimmedPrompt, correctAnswer: trimmedAnswer, marks }],
      "manual",
    );
  }

  const totalMarks = keys.reduce((sum, key) => sum + key.marks, 0);

  return (
    <OnboardingShell step={3} backHref="/onboarding/capabilities">
      <div className="text-center">
        <p className="font-hand text-2xl text-pen">Set up the red pen</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Bring the answer key you already trust.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-ink-soft">
          Upload the full PDF — the same way you would in the app — and we&apos;ll pull every
          question. Or type one question if you just want a quick taste.
        </p>
      </div>

      {mode === "choose" || mode === "preview" ? (
        <div className="mt-8 space-y-4">
          <div className="rounded-2xl border border-line bg-paper p-5 text-left shadow-paper">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-pen">Recommended</p>
            <h2 className="mt-2 font-display text-xl font-semibold text-ink">
              Upload your answer key PDF
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Drop in the key for this test. Graider extracts prompts, model answers, and marks —
              then you photograph student papers against <em className="not-italic font-semibold text-ink">your</em> rubric.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => void onPickPdf(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className={`${btnPrimary} mt-4 w-full justify-center py-3 disabled:opacity-60`}
            >
              {busy ? "Reading your PDF…" : pdfName ? `Replace · ${pdfName}` : "Choose PDF answer key"}
            </button>
          </div>

          {mode === "preview" && keys.length > 0 ? (
            <div className="rounded-2xl border border-line bg-cream/50 p-5 text-left">
              <p className="text-sm font-semibold text-ink">
                Found {keys.length} question{keys.length === 1 ? "" : "s"} · {totalMarks} marks
              </p>
              {truncated ? (
                <p className="mt-1 text-xs text-ink-faint">
                  Showing the first {keys.length} for this free demo. Sign up to keep the full bank.
                </p>
              ) : null}
              <ul className="mt-4 max-h-56 space-y-3 overflow-y-auto">
                {keys.map((key, index) => (
                  <li key={`${index}-${key.prompt.slice(0, 24)}`} className="rounded-xl border border-line bg-paper px-3 py-2.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                      Q{index + 1} · {key.marks} mark{key.marks === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink line-clamp-2">{key.prompt}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft line-clamp-2">
                      Key: {key.correctAnswer}
                    </p>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => continueWithKeys(keys, "pdf")}
                className={`${btnPrimary} mt-4 w-full justify-center py-3`}
              >
                Grade a student paper with this key
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setMode("manual");
              setError(null);
            }}
            className="w-full text-center text-sm font-bold text-ink-soft underline decoration-line underline-offset-4 transition-colors hover:text-pen"
          >
            Skip PDF — type one question quickly
          </button>
        </div>
      ) : null}

      {mode === "manual" ? (
        <form onSubmit={onManualSubmit} className="mt-8 space-y-5">
          <p className="rounded-xl border border-line bg-cream/60 px-3.5 py-2.5 text-sm leading-relaxed text-ink-soft">
            Quick route: one question is enough for the demo. You can import a full PDF after you sign up.
          </p>
          <FormField label="Question prompt" hint="What you asked the student.">
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
            hint="The model answer. Be specific — Graider uses this verbatim."
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

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button type="submit" className={`${btnPrimary} w-full justify-center py-3`}>
              Continue to student paper
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("choose");
                setError(null);
              }}
              className={`${btnSecondary} w-full justify-center py-3`}
            >
              Back to PDF upload
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-pen-soft/60 bg-pen-wash px-3.5 py-2.5 text-sm font-bold text-pen-deep"
        >
          {error}
        </p>
      ) : null}
    </OnboardingShell>
  );
}
