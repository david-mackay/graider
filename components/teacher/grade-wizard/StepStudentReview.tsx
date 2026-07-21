"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import { IconX } from "@/components/shared/icons";
import {
  duplicateNameCounts,
  rosterDisplayLabel,
} from "@/lib/roster-display";
import type { OcrAnswer, RosterEntry, StackPagePreview } from "@/lib/types";

type StudentReviewGroup = {
  studentId: string;
  studentName: string;
  pages: StackPagePreview[];
};

type StepStudentReviewProps = {
  pages: StackPagePreview[];
  pageToStudentId: Map<number, string>;
  /** Object URLs for the pages the teacher just uploaded (indexed by pageIndex). */
  pageImageUrls?: string[];
  roster: RosterEntry[];
  onOcrAnswersChange: (pageIndex: number, answers: OcrAnswer[]) => void;
  onConfirm: () => void;
  onBack: () => void;
  isBusy: boolean;
  errorMessage: string;
};

function rosterName(
  roster: RosterEntry[],
  nameCounts: Map<string, number>,
  studentId: string,
): string {
  const entry = roster.find((r) => r.user_id === studentId);
  if (!entry) return studentId.slice(0, 8);
  return rosterDisplayLabel(entry, nameCounts).primaryLabel;
}

function emptyAnswer(): OcrAnswer {
  return { question: "", answer: "", question_index: null };
}

export default function StepStudentReview({
  pages,
  pageToStudentId,
  pageImageUrls,
  roster,
  onOcrAnswersChange,
  onConfirm,
  onBack,
  isBusy,
  errorMessage,
}: StepStudentReviewProps) {
  const nameCounts = useMemo(() => duplicateNameCounts(roster), [roster]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<{ url: string; page: number } | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLightbox(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  const groups = useMemo((): StudentReviewGroup[] => {
    const byStudent = new Map<string, StackPagePreview[]>();
    for (const page of pages) {
      const studentId = pageToStudentId.get(page.pageIndex);
      if (!studentId) continue;
      const list = byStudent.get(studentId) ?? [];
      list.push(page);
      byStudent.set(studentId, list);
    }

    return Array.from(byStudent.entries()).map(([studentId, studentPages]) => ({
      studentId,
      studentName: rosterName(roster, nameCounts, studentId),
      pages: [...studentPages].sort((a, b) => a.pageIndex - b.pageIndex),
    }));
  }, [pages, pageToStudentId, roster, nameCounts]);

  const totalAnswers = useMemo(
    () => groups.reduce((sum, g) => sum + g.pages.reduce((s, p) => s + p.ocrAnswers.length, 0), 0),
    [groups],
  );

  function toggle(studentId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function updateAnswer(page: StackPagePreview, index: number, patch: Partial<OcrAnswer>) {
    const next = page.ocrAnswers.map((a, i) =>
      i === index ? { ...a, ...patch } : a,
    );
    onOcrAnswersChange(page.pageIndex, next);
  }

  function addAnswer(page: StackPagePreview) {
    onOcrAnswersChange(page.pageIndex, [...page.ocrAnswers, emptyAnswer()]);
  }

  function removeAnswer(page: StackPagePreview, index: number) {
    const next = page.ocrAnswers.filter((_, i) => i !== index);
    onOcrAnswersChange(page.pageIndex, next);
  }

  const emptyGroups = groups.filter((g) => g.pages.length === 0);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">
              Review before grading
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              {groups.length} student{groups.length === 1 ? "" : "s"} · {totalAnswers} answer
              {totalAnswers === 1 ? "" : "s"} detected. Fix any misreads before you grade.
            </p>
          </div>
          <Badge variant="green">Assigned</Badge>
        </div>
      </Card>

      {emptyGroups.length > 0 ? (
        <Card className="border-marigold/40 bg-marigold-wash/50">
          <p className="text-sm font-bold text-ink">
            {emptyGroups.length} student{emptyGroups.length === 1 ? "" : "s"} have no pages.
          </p>
        </Card>
      ) : null}

      {errorMessage ? (
        <Card className="border-pen-soft/60 bg-pen-wash">
          <p className="text-sm font-bold text-pen-deep">{errorMessage}</p>
        </Card>
      ) : null}

      <ul className="space-y-3">
        {groups.map((group) => {
          const isOpen = expanded.has(group.studentId);
          const answerCount = group.pages.reduce((s, p) => s + p.ocrAnswers.length, 0);
          return (
            <li key={group.studentId}>
              <div className="rounded-2xl border border-line bg-paper p-4 shadow-paper">
                <button
                  type="button"
                  onClick={() => toggle(group.studentId)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                  aria-expanded={isOpen}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-semibold text-ink">
                      {group.studentName}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {group.pages.length} page{group.pages.length === 1 ? "" : "s"} ·{" "}
                      {answerCount} answer{answerCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-pen">
                    {isOpen ? "Hide" : "Show"} answers
                  </span>
                </button>

                {isOpen ? (
                  <div className="mt-4 space-y-4 border-t border-line-soft pt-4">
                    {group.pages.map((page) => {
                      const localImageUrl =
                        pageImageUrls && pageImageUrls[page.pageIndex]
                          ? pageImageUrls[page.pageIndex]
                          : null;
                      return (
                        <div
                          key={page.pageIndex}
                          className="rounded-xl border border-line bg-cream/40 p-4"
                        >
                          <div className="flex flex-col gap-4 md:flex-row">
                            <div className="md:w-44 md:flex-shrink-0">
                              <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-ink-faint">
                                Page {page.pageIndex + 1}
                              </p>
                              {localImageUrl ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLightbox({ url: localImageUrl, page: page.pageIndex + 1 })
                                  }
                                  className="group block h-40 w-32 cursor-zoom-in overflow-hidden rounded-md border border-line bg-cream shadow-paper"
                                  aria-label={`View page ${page.pageIndex + 1} photo`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={localImageUrl}
                                    alt={`Page ${page.pageIndex + 1}`}
                                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                  />
                                </button>
                              ) : (
                                <div
                                  aria-hidden="true"
                                  className="flex h-40 w-32 items-center justify-center rounded-md border border-line bg-cream text-ink-faint"
                                >
                                  <svg
                                    className="h-8 w-8"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.6}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M4.5 4.5A2.25 2.25 0 0 1 6.75 2.25h6.75a3.375 3.375 0 0 1 3.375 3.375v13.125a2.25 2.25 0 0 1-2.25 2.25H6.75a2.25 2.25 0 0 1-2.25-2.25V4.5Z"
                                    />
                                  </svg>
                                </div>
                              )}
                              {page.studentNameGuess ? (
                                <p className="mt-2 truncate text-xs text-ink-soft">
                                  Name on paper:{" "}
                                  <span className="font-hand text-sm text-ink">
                                    {page.studentNameGuess}
                                  </span>
                                </p>
                              ) : null}
                            </div>

                            <div className="min-w-0 flex-1 space-y-3">
                              {page.ocrAnswers.length === 0 ? (
                                <p className="text-xs italic text-ink-faint">
                                  No answers extracted from this page. Add one manually if needed.
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
                                        <span className="text-xs font-bold text-ink">
                                          Question
                                        </span>
                                        <input
                                          type="text"
                                          value={answer.question}
                                          onChange={(e) =>
                                            updateAnswer(page, idx, {
                                              question: e.target.value,
                                            })
                                          }
                                          placeholder="Question prompt (optional)"
                                          disabled={isBusy}
                                          className={`${inputClass} mt-1`}
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="text-xs font-bold text-ink">
                                          Question #
                                        </span>
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
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
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
          disabled={isBusy || groups.length === 0}
          className={btnPrimary}
        >
          {isBusy ? "Grading…" : `Confirm & grade (${groups.length})`}
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
