"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import { IconX } from "@/components/shared/icons";
import CopyableError from "@/components/shared/CopyableError";
import RosterPicker from "@/components/teacher/grade-wizard/RosterPicker";
import {
  SKIP_VALUE,
  type AssignmentMap,
  type AssignmentValue,
} from "@/components/teacher/grade-wizard/use-stack-grade";
import type { OcrAnswer, RosterEntry, StackPagePreview } from "@/lib/types";

type StepReviewMatchesProps = {
  pages: StackPagePreview[];
  /** Object URLs of the uploaded page photos, indexed by pageIndex. */
  pageImageUrls: string[];
  roster: RosterEntry[];
  assignments: AssignmentMap;
  onAssignmentChange: (pageIndex: number, value: AssignmentValue) => void;
  onOcrAnswersChange: (pageIndex: number, answers: OcrAnswer[]) => void;
  onConfirm: () => void;
  onBack: () => void;
  isBusy: boolean;
  errorMessage: string;
};

function emptyOcrAnswer(): OcrAnswer {
  return { question: "", answer: "", question_index: null };
}

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
  pageImageUrls,
  roster,
  assignments,
  onAssignmentChange,
  onOcrAnswersChange,
  onConfirm,
  onBack,
  isBusy,
  errorMessage,
}: StepReviewMatchesProps) {
  const [expandedAnswers, setExpandedAnswers] = useState<Set<number>>(new Set());
  const [lightbox, setLightbox] = useState<{ url: string; page: number } | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLightbox(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

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

  function updateAnswer(page: StackPagePreview, index: number, patch: Partial<OcrAnswer>) {
    const next = page.ocrAnswers.map((a, i) => (i === index ? { ...a, ...patch } : a));
    onOcrAnswersChange(page.pageIndex, next);
  }

  function addAnswer(page: StackPagePreview) {
    onOcrAnswersChange(page.pageIndex, [...page.ocrAnswers, emptyOcrAnswer()]);
  }

  function removeAnswer(page: StackPagePreview, index: number) {
    onOcrAnswersChange(
      page.pageIndex,
      page.ocrAnswers.filter((_, i) => i !== index),
    );
  }

  const confirmDisabled = isBusy || counts.toGrade === 0 || counts.needsAssignment > 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">Whose paper is whose?</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Confirm which student each page belongs to. Pages we couldn&apos;t auto-match are at the top.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            <span className="font-bold text-pen-deep">{counts.toGrade}</span> to grade
            <span className="text-line">·</span>
            <span className="font-bold text-ink-soft">{counts.skipped}</span> skipped
            {counts.needsAssignment > 0 ? (
              <>
                <span className="text-line">·</span>
                <span className="font-bold text-marigold-deep">{counts.needsAssignment}</span> need a student
              </>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          Re-grading existing attempts will overwrite previous answers.
        </p>
      </Card>

      {errorMessage ? <CopyableError message={errorMessage} /> : null}

      <ul className="space-y-3">
        {sortedPages.map((page) => {
          const isUnmatched = page.status === "unmatched";
          const value: AssignmentValue = (assignments[page.pageIndex] ?? "") as AssignmentValue;
          const isAnswersOpen = expandedAnswers.has(page.pageIndex);
          const imageUrl = pageImageUrls[page.pageIndex];

          return (
            <li key={page.pageIndex}>
              <div
                className={`rounded-2xl border p-4 shadow-paper transition-colors duration-150 ${
                  isUnmatched
                    ? "border-marigold/40 bg-marigold-wash/50"
                    : "border-line bg-paper"
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="flex w-full items-start gap-3 md:w-72 md:flex-shrink-0">
                    {imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setLightbox({ url: imageUrl, page: page.pageIndex + 1 })}
                        className="group relative h-24 w-[4.5rem] flex-shrink-0 cursor-zoom-in overflow-hidden rounded-md border border-line bg-cream shadow-paper"
                        aria-label={`View page ${page.pageIndex + 1} photo`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl}
                          alt={`Page ${page.pageIndex + 1}`}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      </button>
                    ) : (
                      <div
                        aria-hidden="true"
                        className="flex h-24 w-[4.5rem] flex-shrink-0 items-center justify-center rounded-md border border-line bg-cream"
                      >
                        <svg
                          className="h-6 w-6 text-ink-faint"
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
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-semibold text-ink">
                        Page {page.pageIndex + 1}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-soft truncate">
                        Name on paper:{" "}
                        <span className="font-hand text-base text-ink">
                          {page.studentNameGuess
                            ? `“${page.studentNameGuess}”`
                            : "none found"}
                        </span>
                      </p>
                      <div className="mt-2">{statusBadge(page.status, page.confidence)}</div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <label
                      htmlFor={`roster-${page.pageIndex}`}
                      className="text-xs font-bold uppercase tracking-[0.15em] text-ink-faint"
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

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => toggleAnswers(page.pageIndex)}
                        className="cursor-pointer text-xs font-bold text-pen hover:text-pen-deep transition-colors duration-150"
                        aria-expanded={isAnswersOpen}
                      >
                        {isAnswersOpen ? "Hide" : "Edit"} extracted answers ({page.ocrAnswers.length})
                      </button>
                      {isAnswersOpen ? (
                        <div className="mt-2 space-y-3 rounded-xl border border-line bg-cream p-3">
                          {page.ocrAnswers.length === 0 ? (
                            <p className="text-xs italic text-ink-faint">
                              No answers were extracted from this page. Add one manually if needed.
                            </p>
                          ) : (
                            page.ocrAnswers.map((answer, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg border border-line bg-paper p-3"
                              >
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-faint">
                                    Answer {idx + 1}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => removeAnswer(page, idx)}
                                    disabled={isBusy}
                                    className="cursor-pointer text-xs font-bold text-ink-soft transition-colors duration-150 hover:text-pen disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label={`Remove answer ${idx + 1}`}
                                  >
                                    Remove
                                  </button>
                                </div>

                                <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                                  <label className="block">
                                    <span className="text-xs font-bold text-ink">Question</span>
                                    <input
                                      type="text"
                                      value={answer.question}
                                      onChange={(e) =>
                                        updateAnswer(page, idx, { question: e.target.value })
                                      }
                                      placeholder="Question prompt (optional)"
                                      disabled={isBusy}
                                      className={`${inputClass} mt-1`}
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs font-bold text-ink">Question #</span>
                                    <input
                                      type="number"
                                      min={1}
                                      value={
                                        answer.question_index != null
                                          ? answer.question_index + 1
                                          : ""
                                      }
                                      onChange={(e) => {
                                        const raw = e.target.value.trim();
                                        const parsed = raw === "" ? null : Number(raw);
                                        const next =
                                          parsed !== null && Number.isFinite(parsed) && parsed >= 1
                                            ? parsed - 1
                                            : null;
                                        updateAnswer(page, idx, { question_index: next });
                                      }}
                                      placeholder="e.g. 1"
                                      disabled={isBusy}
                                      className={`${inputClass} mt-1`}
                                    />
                                  </label>
                                </div>

                                <label className="mt-2 block">
                                  <span className="text-xs font-bold text-ink">
                                    Student answer
                                  </span>
                                  <textarea
                                    value={answer.answer}
                                    onChange={(e) =>
                                      updateAnswer(page, idx, { answer: e.target.value })
                                    }
                                    placeholder="Fix any OCR misreads…"
                                    disabled={isBusy}
                                    rows={2}
                                    className={`${inputClass} mt-1 min-h-[3rem] resize-y`}
                                  />
                                </label>
                              </div>
                            ))
                          )}

                          <button
                            type="button"
                            onClick={() => addAnswer(page)}
                            disabled={isBusy}
                            className="cursor-pointer rounded-full border-2 border-dashed border-pen/40 bg-pen-wash/20 px-4 py-2 text-xs font-bold text-pen-deep transition-colors duration-150 hover:bg-pen-wash/40 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            + Add answer
                          </button>
                        </div>
                      ) : null}
                    </div>
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
          {isBusy ? "Marking…" : `Grade all (${counts.toGrade})`}
        </button>
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Page ${lightbox.page} photo`}
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={`Page ${lightbox.page}`}
              className="max-h-[85vh] max-w-full rounded-lg border border-line bg-paper shadow-lifted"
            />
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute -right-3 -top-3 cursor-pointer rounded-full bg-paper p-2 text-ink shadow-card transition-transform duration-150 hover:scale-105"
              aria-label="Close preview"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
