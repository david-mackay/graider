"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import ParsePresetPicker from "@/components/shared/ParsePresetPicker";
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
import {
  defaultPresetForSurface,
  type DocumentParsePreset,
} from "@/lib/parse-presets";

const DEFAULT_PROMPT = "Name two functions of the mitochondria.";
const DEFAULT_CORRECT_ANSWER =
  "Mitochondria produce ATP via cellular respiration, and they regulate cellular metabolism / signal apoptosis.";

type ParseResponse = {
  questions?: OnboardingAnswerKey[];
  truncated?: boolean;
  totalFound?: number;
  error?: string;
  needsPhoto?: boolean;
};

function blankKey(): OnboardingAnswerKey {
  return {
    prompt: "",
    correctAnswer: "",
    marks: 1,
    questionType: "open",
    choices: null,
  };
}

function normalizeIncoming(raw: OnboardingAnswerKey[]): OnboardingAnswerKey[] {
  return raw.map((q) => ({
    prompt: q.prompt ?? "",
    correctAnswer: q.correctAnswer ?? "",
    marks: Number.isInteger(q.marks) && q.marks > 0 ? q.marks : 1,
    questionType: q.questionType === "mcq" ? "mcq" : "open",
    choices: Array.isArray(q.choices) ? q.choices : null,
  }));
}

export default function OnboardingAnswerKeyPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"choose" | "manual" | "preview">("choose");
  const [keys, setKeys] = useState<OnboardingAnswerKey[]>([]);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [marks, setMarks] = useState(5);
  const [manualType, setManualType] = useState<"open" | "mcq">("open");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [parsePreset, setParsePreset] = useState<DocumentParsePreset>(() =>
    defaultPresetForSurface("answer_key_pdf"),
  );

  useEffect(() => {
    fireEvent(ONBOARDING_EVENTS.ANSWER_KEY);
    const vault = getVault();
    const existing = normalizeAnswerKeys(vault);
    if (existing.length > 0) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setKeys(normalizeIncoming(existing));
      setMode(vault?.answerKeySource === "manual" && existing.length === 1 ? "manual" : "preview");
      if (existing.length === 1) {
        setPrompt(existing[0].prompt);
        setCorrectAnswer(existing[0].correctAnswer);
        setMarks(existing[0].marks);
        setManualType(existing[0].questionType === "mcq" ? "mcq" : "open");
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);

  async function parseUpload(formData: FormData, label: string) {
    setError(null);
    setBusy(true);
    setUploadName(label);
    try {
      const res = await fetch("/api/onboarding/parse-answer-key", {
        method: "POST",
        body: formData,
      });
      const raw = await res.text();
      let payload: ParseResponse;
      try {
        payload = JSON.parse(raw) as ParseResponse;
      } catch {
        if (res.status === 413) {
          throw new Error("File is too large. Keep it under 4 MB, or add the key manually.");
        }
        throw new Error(
          "That upload didn't go through — the file may be too large or took too long. Try a smaller file or add the key manually.",
        );
      }
      const questions = normalizeIncoming(payload.questions ?? []);
      if (!res.ok) {
        if (payload.needsPhoto || questions.length === 0) {
          setKeys([blankKey()]);
          setMode("preview");
          setError(
            payload.error ??
              "We couldn't prefill from that file. Tweak the review below, or photograph the key.",
          );
          return;
        }
        throw new Error(payload.error ?? "Could not read that answer key.");
      }
      if (questions.length === 0) {
        setKeys([blankKey()]);
        setMode("preview");
        setError("Nothing found — add questions in the review below.");
        return;
      }
      setKeys(questions);
      setTruncated(Boolean(payload.truncated));
      setMode("preview");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that answer key.");
      setUploadName(null);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      if (imageRef.current) imageRef.current.value = "";
    }
  }

  async function onPickPdf(file: File | null) {
    if (!file) return;
    const formData = new FormData();
    formData.append("pdf", file, file.name);
    formData.append("parsePreset", parsePreset);
    await parseUpload(formData, file.name);
  }

  async function onPickImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    const preset =
      parsePreset === "typed_pdf"
        ? defaultPresetForSurface("answer_key_photo")
        : parsePreset;
    if (preset !== parsePreset) setParsePreset(preset);
    const formData = new FormData();
    Array.from(files).forEach((file, index) => {
      formData.append("image", file, file.name || `key-${index + 1}.jpg`);
    });
    formData.append("parsePreset", preset);
    await parseUpload(formData, files.length === 1 ? files[0].name : `${files.length} photos`);
  }

  function updateKey(index: number, patch: Partial<OnboardingAnswerKey>) {
    setKeys((prev) => prev.map((key, i) => (i === index ? { ...key, ...patch } : key)));
  }

  function removeKey(index: number) {
    setKeys((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [blankKey()];
    });
  }

  function continueWithKeys(nextKeys: OnboardingAnswerKey[], source: "pdf" | "manual") {
    const cleaned = nextKeys
      .map((q) => ({
        ...q,
        prompt: q.prompt.trim(),
        correctAnswer: q.correctAnswer.trim(),
        marks: Number.isInteger(q.marks) && q.marks > 0 ? q.marks : 1,
        questionType: q.questionType === "mcq" ? ("mcq" as const) : ("open" as const),
        choices: q.questionType === "mcq" ? q.choices ?? null : null,
      }))
      .filter((q) => q.prompt && q.correctAnswer);
    if (cleaned.length === 0) {
      setError("Add at least one question with a prompt and correct answer.");
      return;
    }
    setVault(answerKeyVaultUpdate(cleaned, source));
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
      [
        {
          prompt: trimmedPrompt,
          correctAnswer: trimmedAnswer,
          marks,
          questionType: manualType,
          choices: null,
        },
      ],
      "manual",
    );
  }

  const totalMarks = keys.reduce((sum, key) => sum + (Number.isFinite(key.marks) ? key.marks : 0), 0);

  return (
    <OnboardingShell step={3} backHref="/onboarding/capabilities" wide={mode === "preview"}>
      <div className="text-center">
        <p className="font-hand text-2xl text-pen">Set up the red pen</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Bring the answer key you already trust.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-soft">
          Upload a PDF or photo — including MCQ letter keys or circled answers. We&apos;ll prefill
          what we can; you tweak the review before grading.
        </p>
      </div>

      {mode === "choose" || mode === "preview" ? (
        <div className="mt-8 space-y-4">
          <div className="rounded-2xl border border-line bg-paper p-5 text-left shadow-paper">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-pen">Recommended</p>
            <h2 className="mt-2 font-display text-xl font-semibold text-ink">
              Upload your answer key
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              PDF for typed keys, or a photo if answers are circled / the PDF is a scan. Best-effort
              prefill — you&apos;ll review every question next.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => void onPickPdf(e.target.files?.[0] ?? null)}
            />
            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => void onPickImages(e.target.files)}
            />
            <ParsePresetPicker
              surface="answer_key_pdf"
              value={parsePreset}
              onChange={setParsePreset}
              disabled={busy}
              className="mt-4"
            />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className={`${btnPrimary} w-full justify-center py-3 disabled:opacity-60`}
              >
                {busy ? "Reading…" : uploadName?.endsWith(".pdf") ? `Replace · ${uploadName}` : "Choose PDF"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => imageRef.current?.click()}
                className={`${btnSecondary} w-full justify-center py-3 disabled:opacity-60`}
              >
                {busy ? "Reading…" : "Upload photo(s)"}
              </button>
            </div>
            {busy ? (
              <div className="mt-4 space-y-2" role="status" aria-live="polite">
                <p className="text-xs font-semibold text-ink-soft">
                  Reading your answer key…
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="progress-indeterminate-bar h-full w-2/5 rounded-full bg-pen" />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-ink-faint">
                Scanned or circled keys work too — upload the PDF or a clear photo.
              </p>
            )}
          </div>

          {mode === "preview" ? (
            <div className="rounded-2xl border border-line bg-cream/50 p-5 text-left sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    Review {keys.length} question{keys.length === 1 ? "" : "s"} · {totalMarks} marks
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    Prefill is a draft — fix letters, stems, and types before continuing.
                  </p>
                </div>
                {truncated ? (
                  <p className="text-xs text-ink-faint">
                    Showing the first {keys.length} for this free demo (max 200).
                  </p>
                ) : null}
              </div>
              <ul className="mt-5 max-h-[min(70vh,40rem)] space-y-4 overflow-y-auto pr-1">
                {keys.map((key, index) => (
                  <li
                    key={`row-${index}`}
                    className="space-y-3 rounded-xl border border-line bg-paper px-4 py-4 sm:px-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                        Q{index + 1}
                      </p>
                      <select
                        value={key.questionType === "mcq" ? "mcq" : "open"}
                        onChange={(e) =>
                          updateKey(index, {
                            questionType: e.target.value === "mcq" ? "mcq" : "open",
                            marks: e.target.value === "mcq" ? 1 : key.marks,
                          })
                        }
                        className={`${inputClass} !w-auto !py-1.5 text-xs`}
                      >
                        <option value="open">Open</option>
                        <option value="mcq">MCQ</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={key.marks}
                        onChange={(e) => {
                          const next = Number.parseInt(e.target.value, 10);
                          updateKey(index, { marks: Number.isFinite(next) ? next : 1 });
                        }}
                        className={`${inputClass} !max-w-20 !py-1.5 text-xs`}
                        aria-label="Marks"
                      />
                      <button
                        type="button"
                        onClick={() => removeKey(index)}
                        className="ml-auto text-xs font-bold text-ink-faint hover:text-pen"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <textarea
                        value={key.prompt}
                        onChange={(e) => updateKey(index, { prompt: e.target.value })}
                        rows={3}
                        className={inputClass}
                        placeholder="Question prompt"
                      />
                      <div className="space-y-2">
                        <textarea
                          value={key.correctAnswer}
                          onChange={(e) => updateKey(index, { correctAnswer: e.target.value })}
                          rows={key.questionType === "mcq" ? 1 : 3}
                          className={inputClass}
                          placeholder={
                            key.questionType === "mcq" ? "Correct letter (e.g. B)" : "Correct answer"
                          }
                        />
                        {key.questionType === "mcq" && key.choices && key.choices.length > 0 ? (
                          <ul className="space-y-0.5 text-xs text-ink-soft">
                            {key.choices.map((c) => (
                              <li key={c.key}>
                                <span className="font-semibold text-ink">{c.key}.</span> {c.text}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setKeys((prev) => [...prev, blankKey()])}
                className="mt-3 text-sm font-bold text-ink-soft underline decoration-line underline-offset-4 hover:text-pen"
              >
                Add question
              </button>
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
            Skip upload — type one question quickly
          </button>
        </div>
      ) : null}

      {mode === "manual" ? (
        <form onSubmit={onManualSubmit} className="mt-8 space-y-5">
          <p className="rounded-xl border border-line bg-cream/60 px-3.5 py-2.5 text-sm leading-relaxed text-ink-soft">
            Quick route: one question is enough for the demo. You can import a full key after you sign up.
          </p>
          <FormField label="Type">
            <select
              value={manualType}
              onChange={(e) => {
                const next = e.target.value === "mcq" ? "mcq" : "open";
                setManualType(next);
                if (next === "mcq") setMarks(1);
              }}
              className={inputClass}
            >
              <option value="open">Open-ended</option>
              <option value="mcq">Multiple choice</option>
            </select>
          </FormField>
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
            label={manualType === "mcq" ? "Correct letter" : "Correct answer"}
            hint={
              manualType === "mcq"
                ? "Letter only (A–E). Grading is exact match."
                : "The model answer. Be specific — Graider uses this verbatim."
            }
          >
            <textarea
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              rows={manualType === "mcq" ? 1 : 4}
              className={inputClass}
              placeholder={manualType === "mcq" ? "B" : DEFAULT_CORRECT_ANSWER}
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
              Back to upload
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
