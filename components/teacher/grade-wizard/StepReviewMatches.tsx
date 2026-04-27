"use client";

import { useMemo, useState } from "react";
import { Badge, Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import RosterPicker from "@/components/teacher/grade-wizard/RosterPicker";
import {
  SKIP_VALUE,
  type AssignmentMap,
  type AssignmentValue,
} from "@/components/teacher/grade-wizard/use-stack-grade";
import type { RosterEntry, StackPagePreview } from "@/lib/types";

type StepReviewMatchesProps = {
  pages: StackPagePreview[];
  roster: RosterEntry[];
  assignments: AssignmentMap;
  onAssignmentChange: (pageIndex: number, value: AssignmentValue) => void;
  onConfirm: () => void;
  onBack: () => void;
  isBusy: boolean;
  errorMessage: string;
};

const STATUS_ORDER: Record<StackPagePreview["status"], number> = {
  unmatched: 0,
  fuzzy: 1,
  exact: 2,
};

function statusBadge(status: StackPagePreview["status"], confidence: number) {
  if (status === "exact") {
    return <Badge variant="green">Exact match</Badge>;
  }
  if (status === "fuzzy") {
    const pct = Math.round(confidence * 100);
    return <Badge variant="yellow">Likely{pct ? ` · ${pct}%` : ""}</Badge>;
  }
  return <Badge variant="gray">Unmatched</Badge>;
}

export default function StepReviewMatches({
  pages,
  roster,
  assignments,
  onAssignmentChange,
  onConfirm,
  onBack,
  isBusy,
  errorMessage,
}: StepReviewMatchesProps) {
  const [expandedAnswers, setExpandedAnswers] = useState<Set<number>>(new Set());

  const sortedPages = useMemo(() => {
    return [...pages].sort((a, b) => {
      const orderDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (orderDiff !== 0) return orderDiff;
      return a.pageIndex - b.pageIndex;
    });
  }, [pages]);

  const counts = useMemo(() => {
    let toGrade = 0;
    let skipped = 0;
    let needsAssignment = 0;
    for (const page of pages) {
      const value = assignments[page.pageIndex];
      if (value === SKIP_VALUE) skipped += 1;
      else if (value && value.length > 0) toGrade += 1;
      else needsAssignment += 1;
    }
    return { toGrade, skipped, needsAssignment };
  }, [pages, assignments]);

  function toggleAnswers(pageIndex: number) {
    setExpandedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(pageIndex)) next.delete(pageIndex);
      else next.add(pageIndex);
      return next;
    });
  }

  const confirmDisabled = isBusy || counts.toGrade === 0 || counts.needsAssignment > 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-indigo-950">Review matches</h3>
            <p className="mt-1 text-sm text-slate-500">
              Confirm which student each page belongs to. Pages we couldn&apos;t auto-match are at the top.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-indigo-700">{counts.toGrade}</span> to grade
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-slate-600">{counts.skipped}</span> skipped
            {counts.needsAssignment > 0 ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-semibold text-amber-700">{counts.needsAssignment}</span> need a student
              </>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Re-grading existing attempts will overwrite previous answers.
        </p>
      </Card>

      {errorMessage ? (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm font-medium text-red-700">{errorMessage}</p>
        </Card>
      ) : null}

      <ul className="space-y-3">
        {sortedPages.map((page) => {
          const isUnmatched = page.status === "unmatched";
          const value: AssignmentValue = (assignments[page.pageIndex] ?? "") as AssignmentValue;
          const isAnswersOpen = expandedAnswers.has(page.pageIndex);

          return (
            <li key={page.pageIndex}>
              <div
                className={`rounded-xl border p-4 transition-colors duration-150 ${
                  isUnmatched
                    ? "border-red-200 bg-red-50"
                    : "border-indigo-100 bg-white"
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="flex w-full items-start gap-3 md:w-72 md:flex-shrink-0">
                    <div
                      aria-hidden="true"
                      className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded-md border border-indigo-100 bg-indigo-50/60"
                    >
                      <svg
                        className="h-6 w-6 text-indigo-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.6}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m4.5 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-indigo-950">
                        Page {page.pageIndex + 1}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        OCR read:{" "}
                        <span className="font-medium text-slate-700">
                          {page.studentNameGuess
                            ? `“${page.studentNameGuess}”`
                            : "no name detected"}
                        </span>
                      </p>
                      <div className="mt-2">{statusBadge(page.status, page.confidence)}</div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <label
                      htmlFor={`roster-${page.pageIndex}`}
                      className="text-xs font-semibold uppercase tracking-wide text-indigo-400"
                    >
                      Assign to student
                    </label>
                    <div className="mt-1.5">
                      <RosterPicker
                        id={`roster-${page.pageIndex}`}
                        roster={roster}
                        value={value}
                        onChange={(v) => onAssignmentChange(page.pageIndex, v)}
                        disabled={isBusy}
                      />
                    </div>

                    {page.ocrAnswers.length > 0 ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => toggleAnswers(page.pageIndex)}
                          className="cursor-pointer text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors duration-150"
                          aria-expanded={isAnswersOpen}
                        >
                          {isAnswersOpen ? "Hide" : "Show"} extracted answers ({page.ocrAnswers.length})
                        </button>
                        {isAnswersOpen ? (
                          <ul className="mt-2 space-y-1.5 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 text-xs">
                            {page.ocrAnswers.map((answer, idx) => (
                              <li key={idx} className="text-slate-700">
                                <span className="font-semibold text-indigo-700">
                                  Q{answer.question_index != null ? answer.question_index + 1 : idx + 1}:
                                </span>{" "}
                                <span className="font-medium text-slate-800">
                                  {answer.question}
                                </span>
                                <div className="mt-0.5 text-slate-600">
                                  {answer.answer || <span className="italic text-slate-400">no answer</span>}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs italic text-slate-400">
                        No answers were extracted from this page.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} disabled={isBusy} className={btnSecondary}>
          Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          className={btnPrimary}
        >
          {isBusy ? "Grading…" : `Grade all (${counts.toGrade})`}
        </button>
      </div>
    </div>
  );
}
