"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import type { TestDetail } from "@/lib/types";

type TestTakingFormProps = {
  test: TestDetail;
  answers: Record<string, string>;
  onChangeAnswer: (questionId: string, value: string) => void;
  onSubmit: (opts?: { timedOut?: boolean }) => Promise<void> | void;
  onClose: () => void;
  isBusy: boolean;
  deadlineAt: string | null;
  durationMinutes: number | null;
};

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

export default function TestTakingForm({
  test,
  answers,
  onChangeAnswer,
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
  const timedOutFiredRef = useRef(false);

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
    void onSubmit({ timedOut: true });
  }, [remainingMs, isBusy, onSubmit]);

  const isCritical = remainingMs !== null && remainingMs <= 60_000;
  const isWarning = remainingMs !== null && remainingMs <= 5 * 60_000 && remainingMs > 60_000;

  return (
    <div className="fixed inset-0 z-50 bg-cream overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-pen">In progress</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink">{test.title}</h2>
            <p className="mt-1 text-sm text-ink-faint">
              {test.questions.length} question{test.questions.length !== 1 ? "s" : ""} · {totalMarks} marks
              {durationMinutes && durationMinutes > 0 ? ` · ${durationMinutes} min limit` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {remainingMs !== null ? (
              <div
                aria-live="polite"
                className={`rounded-full px-3 py-1.5 text-sm font-bold tabular-nums shadow-paper ring-1 ${
                  isCritical
                    ? "bg-pen text-white ring-pen"
                    : isWarning
                      ? "bg-marigold-wash text-marigold-deep ring-marigold/40"
                      : "bg-paper text-ink ring-line"
                }`}
              >
                Time left {formatRemaining(remainingMs)}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink-soft hover:bg-cream transition-colors duration-150"
            >
              Exit (save draft)
            </button>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
          className="space-y-4"
        >
          {test.questions.map((q, i) => (
            <Card key={q.question_id} className="border-line-soft">
              <label className="block">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-faint">
                    Question {i + 1}
                  </span>
                  <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-semibold text-pen">
                    {q.marks} mark{q.marks !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-base font-semibold text-ink leading-relaxed">{q.prompt}</p>
                <textarea
                  required
                  className={`${inputClass} mt-4 min-h-[120px]`}
                  value={answers[q.question_id] ?? ""}
                  onChange={(e) => onChangeAnswer(q.question_id, e.target.value)}
                  placeholder="Type your answer here…"
                />
              </label>
            </Card>
          ))}
          <div className="sticky bottom-4 mt-6">
            <div className="flex gap-3 rounded-2xl border border-line bg-paper/90 backdrop-blur-sm p-3 shadow-card">
              <button className={`${btnPrimary} flex-1 justify-center py-3`} type="submit" disabled={isBusy}>
                {isBusy ? "Submitting…" : "Submit test"}
              </button>
              <button className={btnSecondary} type="button" onClick={onClose}>
                Exit
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
