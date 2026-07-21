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

  const timerTone =
    remainingMs === null
      ? "bg-paper text-ink-soft ring-line"
      : isCritical
        ? "bg-pen text-white ring-pen"
        : isWarning
          ? "bg-marigold-wash text-marigold-deep ring-marigold/40"
          : "bg-paper text-ink ring-line";

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
              onClick={onClose}
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
        </p>
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
