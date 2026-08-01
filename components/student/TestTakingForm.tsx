"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import { resolveMcqChoices } from "@/lib/mcq-choices";
import type { TestDetail } from "@/lib/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type TestTakingFormProps = {
  test: TestDetail;
  answers: Record<string, string>;
  onChangeAnswer: (questionId: string, value: string) => void;
  /** Debounced server-side draft persistence. */
  onSaveDraft: (answers: Record<string, string>) => Promise<void>;
  onSubmit: (opts?: { timedOut?: boolean }) => Promise<void> | void;
  onClose: () => void;
  isBusy: boolean;
  deadlineAt: string | null;
  durationMinutes: number | null;
};

const AUTOSAVE_MS = 800;

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TestTakingForm({
  test,
  answers,
  onChangeAnswer,
  onSaveDraft,
  onSubmit,
  onClose,
  isBusy,
  deadlineAt,
  durationMinutes,
}: TestTakingFormProps) {
  const totalMarks = test.questions.reduce((sum, q) => sum + q.marks, 0);

  const deadlineMs = useMemo(() => {
    if (!deadlineAt) return null;
    const d = new Date(deadlineAt);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }, [deadlineAt]);

  const [now, setNow] = useState(() => Date.now());
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const timedOutFiredRef = useRef(false);
  const answersRef = useRef(answers);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const onSaveDraftRef = useRef(onSaveDraft);

  answersRef.current = answers;
  onSaveDraftRef.current = onSaveDraft;

  const flushSave = useCallback(async () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current || savingRef.current) return;
    dirtyRef.current = false;
    savingRef.current = true;
    setSaveStatus("saving");
    try {
      await onSaveDraftRef.current(answersRef.current);
      setSaveStatus("saved");
    } catch {
      dirtyRef.current = true;
      setSaveStatus("error");
    } finally {
      savingRef.current = false;
      // If more edits arrived while saving, schedule another pass.
      if (dirtyRef.current && timerRef.current == null) {
        timerRef.current = window.setTimeout(() => {
          void flushSave();
        }, AUTOSAVE_MS);
      }
    }
  }, []);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void flushSave();
    }, AUTOSAVE_MS);
  }, [flushSave]);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!deadlineMs) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [deadlineMs]);

  const remainingMs = deadlineMs ? deadlineMs - now : null;

  useEffect(() => {
    if (remainingMs === null) return;
    if (remainingMs > 0) return;
    if (timedOutFiredRef.current) return;
    if (isBusy) return;
    timedOutFiredRef.current = true;
    void (async () => {
      await flushSave();
      await onSubmit({ timedOut: true });
    })();
  }, [remainingMs, isBusy, onSubmit, flushSave]);

  async function handleExit() {
    await flushSave();
    onClose();
  }

  function handleChange(questionId: string, value: string) {
    onChangeAnswer(questionId, value);
    scheduleSave();
  }

  const isCritical = remainingMs !== null && remainingMs <= 60_000;
  const isWarning = remainingMs !== null && remainingMs <= 5 * 60_000 && remainingMs > 60_000;

  const timerTone =
    remainingMs === null
      ? "bg-paper text-ink-soft ring-line"
      : isCritical
        ? "bg-pen text-white ring-pen"
        : isWarning
          ? "bg-marigold-wash text-marigold-deep ring-marigold/40"
          : "bg-paper text-ink ring-line";

  const saveLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "saved"
        ? "Saved"
        : saveStatus === "error"
          ? "Save failed"
          : null;

  return (
    <div className="fixed inset-0 z-50 bg-cream overflow-y-auto">
      <div
        className={`sticky top-0 z-10 border-b px-4 py-3 backdrop-blur-sm ${
          isCritical
            ? "border-pen/30 bg-pen-wash/90"
            : isWarning
              ? "border-marigold/30 bg-marigold-wash/80"
              : "border-line bg-cream/95"
        }`}
      >
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-pen">In progress</p>
            <p className="truncate font-display text-base font-semibold text-ink">{test.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {saveLabel ? (
              <span
                className={`text-xs font-semibold ${
                  saveStatus === "error" ? "text-pen-deep" : "text-ink-faint"
                }`}
              >
                {saveLabel}
              </span>
            ) : null}
            <div
              aria-live="polite"
              aria-atomic="true"
              className={`rounded-full px-3.5 py-1.5 text-sm font-bold tabular-nums shadow-paper ring-1 ${timerTone}`}
            >
              {remainingMs !== null ? (
                <>
                  <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide opacity-80">
                    Time left
                  </span>
                  {formatRemaining(remainingMs)}
                </>
              ) : (
                "No time limit"
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleExit()}
              className="cursor-pointer rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink-soft hover:bg-cream transition-colors duration-150"
            >
              Exit (save draft)
            </button>
          </div>
        </div>
        {deadlineAt && remainingMs !== null ? (
          <p className="mx-auto mt-1.5 max-w-2xl text-xs text-ink-faint">
            Due {formatClock(deadlineAt)}
            {durationMinutes && durationMinutes > 0 ? ` · ${durationMinutes} min limit` : ""}
          </p>
        ) : null}
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="mb-6 text-sm text-ink-faint">
          {test.questions.length} question{test.questions.length !== 1 ? "s" : ""} · {totalMarks} marks
          <span className="text-ink-faint"> · Answers save automatically</span>
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              await flushSave();
              await onSubmit();
            })();
          }}
          className="space-y-4"
        >
          {test.questions.map((q, i) => {
            const mcqChoices = resolveMcqChoices(q);
            return (
              <Card key={q.question_id} className="border-line-soft">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-faint">
                    Question {i + 1}
                    {mcqChoices ? " · Multiple choice" : ""}
                  </span>
                  <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-semibold text-pen">
                    {q.marks} mark{q.marks !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-base font-semibold text-ink leading-relaxed">{q.prompt}</p>
                {mcqChoices ? (
                  <fieldset className="mt-4 space-y-2" aria-label={`Choices for question ${i + 1}`}>
                    <legend className="sr-only">Select an answer</legend>
                    {mcqChoices.map((choice) => {
                      const selected = (answers[q.question_id] ?? "").toUpperCase() === choice.key;
                      return (
                        <label
                          key={choice.key}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors duration-150 ${
                            selected
                              ? "border-pen bg-pen-wash"
                              : "border-line bg-paper hover:border-ink-faint"
                          }`}
                        >
                          <input
                            type="radio"
                            className="mt-1 h-4 w-4 border-ink-faint text-pen focus:ring-pen"
                            name={`q-${q.question_id}`}
                            value={choice.key}
                            checked={selected}
                            required
                            onChange={() => handleChange(q.question_id, choice.key)}
                          />
                          <span className="min-w-0">
                            <span className="font-bold text-pen">{choice.key}.</span>{" "}
                            <span className="text-sm text-ink leading-relaxed">
                              {choice.text === choice.key ? "" : choice.text}
                            </span>
                            {choice.text === choice.key ? (
                              <span className="text-sm text-ink-soft">Option {choice.key}</span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                ) : (
                  <label className="block">
                    <span className="sr-only">Your answer</span>
                    <textarea
                      required
                      className={`${inputClass} mt-4 min-h-[120px]`}
                      value={answers[q.question_id] ?? ""}
                      onChange={(e) => handleChange(q.question_id, e.target.value)}
                      placeholder="Type your answer here…"
                    />
                  </label>
                )}
              </Card>
            );
          })}
          <div className="sticky bottom-4 mt-6">
            <div className="flex gap-3 rounded-2xl border border-line bg-paper/90 backdrop-blur-sm p-3 shadow-card">
              {remainingMs !== null ? (
                <div
                  className={`hidden sm:flex items-center rounded-xl px-3 text-sm font-bold tabular-nums ${
                    isCritical ? "text-pen" : isWarning ? "text-marigold-deep" : "text-ink-soft"
                  }`}
                >
                  {formatRemaining(remainingMs)}
                </div>
              ) : null}
              <button className={`${btnPrimary} flex-1 justify-center py-3`} type="submit" disabled={isBusy}>
                {isBusy ? "Submitting…" : "Submit test"}
              </button>
              <button className={btnSecondary} type="button" onClick={() => void handleExit()}>
                Exit
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
