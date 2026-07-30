"use client";

/**
 * Full-attempt editing panel.
 *
 * Features:
 * - Shows every question with prompt, correct answer (desktop only), and editable
 *   student answer / marks / feedback.
 * - Auto-saves each field on blur via PATCH /api/submissions/:attemptId/answers/:questionId
 * - When studentAnswer changes, the server re-grades and returns new marks + feedback.
 * - Explicit "Save attempt" button at the bottom (per attempt, not per question).
 * - Running total kept in sync after every auto-save.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Card, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import { handleJson } from "@/lib/dashboard-client";
import type { GradedAttemptDetail, GradedAttemptQuestion } from "@/lib/dashboard-types";

// ─── Types ──────────────────────────────────────────────────────────────────

type RowState = {
  studentAnswer: string;
  marksEarned: string; // keep as string for <input>
  feedback: string;
  saving: boolean;
  dirty: boolean;
};

type AttemptGradeEditorProps = {
  attempt: GradedAttemptDetail;
  /** Called when the editor is closed (either after save or via Cancel). */
  onClose: () => void;
  /** Called after the explicit Save button is pressed and all saves complete. */
  onSaved?: (totalMarks: number, maxMarks: number) => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function ratioColour(earned: number, max: number) {
  if (max === 0) return "text-ink-soft";
  const r = earned / max;
  if (r >= 0.8) return "text-moss-deep";
  if (r >= 0.5) return "text-ink";
  return "text-pen";
}

function initRows(questions: GradedAttemptQuestion[]): Map<string, RowState> {
  const map = new Map<string, RowState>();
  for (const q of questions) {
    map.set(q.question_id, {
      studentAnswer: q.student_answer ?? "",
      marksEarned: String(q.marks_earned ?? 0),
      feedback: q.feedback ?? "",
      saving: false,
      dirty: false,
    });
  }
  return map;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AttemptGradeEditor({ attempt, onClose, onSaved }: AttemptGradeEditorProps) {
  const [rows, setRows] = useState<Map<string, RowState>>(() => initRows(attempt.questions));
  const [totalMarks, setTotalMarks] = useState(attempt.total_marks ?? 0);
  const [maxMarks] = useState(attempt.max_marks ?? 0);
  const [saving, setSaving] = useState(false);
  // Track pending auto-saves so the explicit Save button can wait for them.
  const pendingRef = useRef<Set<string>>(new Set());

  // Re-init if a new attempt is opened.
  useEffect(() => {
    setRows(initRows(attempt.questions));
    setTotalMarks(attempt.total_marks ?? 0);
  }, [attempt.id, attempt.questions, attempt.total_marks]);

  function setRow(questionId: string, patch: Partial<RowState>) {
    setRows((prev) => {
      const next = new Map(prev);
      const existing = next.get(questionId);
      if (existing) next.set(questionId, { ...existing, ...patch });
      return next;
    });
  }

  // Auto-save: called on blur of any field.
  const autoSave = useCallback(
    async (questionId: string, overrideStudentAnswer?: string) => {
      const row = rows.get(questionId);
      if (!row || (!row.dirty && overrideStudentAnswer === undefined)) return;

      const studentAnswerChanged = overrideStudentAnswer !== undefined;
      const body: Record<string, unknown> = studentAnswerChanged
        ? { studentAnswer: overrideStudentAnswer ?? row.studentAnswer }
        : {
            marksEarned: Number(row.marksEarned) || 0,
            feedback: row.feedback,
          };

      setRow(questionId, { saving: true, dirty: false });
      pendingRef.current.add(questionId);

      try {
        const data = await handleJson<{
          answer: { marks_earned: number; feedback: string; student_answer: string };
          attempt: { total_marks: number; max_marks: number };
        }>(
          await fetch(`/api/submissions/${attempt.id}/answers/${questionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
        );

        setRow(questionId, {
          saving: false,
          marksEarned: String(data.answer.marks_earned),
          feedback: data.answer.feedback ?? "",
          studentAnswer: data.answer.student_answer ?? row.studentAnswer,
        });
        setTotalMarks(data.attempt.total_marks);
      } catch {
        setRow(questionId, { saving: false, dirty: true });
      } finally {
        pendingRef.current.delete(questionId);
      }
    },
    [attempt.id, rows],
  );

  async function handleSaveAll() {
    setSaving(true);
    // Flush any remaining dirty rows sequentially (auto-saves may already be in flight).
    for (const [qid, row] of rows.entries()) {
      if (row.dirty) await autoSave(qid);
    }
    // Wait for any in-flight auto-saves.
    const wait = () =>
      new Promise<void>((resolve) => {
        const check = () => {
          if (pendingRef.current.size === 0) resolve();
          else setTimeout(check, 50);
        };
        check();
      });
    await wait();
    setSaving(false);
    onSaved?.(totalMarks, maxMarks);
    onClose();
  }

  const anyDirty = [...rows.values()].some((r) => r.dirty || r.saving);
  const ratio = maxMarks > 0 ? totalMarks / maxMarks : 0;

  return (
    <div className="space-y-4 animate-rise">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
            {attempt.student_name ?? "Student"}
          </p>
          <h3 className="mt-0.5 font-display text-xl font-semibold text-ink">{attempt.test_title}</h3>
          <p className={`mt-1 font-hand -rotate-2 text-3xl font-bold ${ratioColour(totalMarks, maxMarks)}`}>
            {totalMarks}/{maxMarks}
          </p>
        </div>
        <Badge variant="blue">Editing</Badge>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {attempt.questions.map((q, idx) => {
          const row = rows.get(q.question_id);
          if (!row) return null;
          const marksNum = Number(row.marksEarned) || 0;

          return (
            <Card key={q.question_id} className="space-y-3">
              {/* Question header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-faint">
                  Q{idx + 1} · {q.marks} mark{q.marks !== 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-2">
                  {row.saving ? (
                    <span className="text-xs text-ink-faint italic">saving…</span>
                  ) : row.dirty ? (
                    <span className="text-xs text-marigold-deep font-medium">unsaved</span>
                  ) : null}
                  <span
                    className={`font-hand text-2xl font-bold ${ratioColour(marksNum, q.marks)}`}
                  >
                    {marksNum}/{q.marks}
                  </span>
                </div>
              </div>

              {/* Prompt */}
              <p className="text-sm font-medium leading-relaxed text-ink">{q.prompt}</p>

              {/* Two-col on desktop: student answer | correct answer */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink-faint">Student answer</label>
                  <textarea
                    className={`${inputClass} min-h-[4rem] resize-y`}
                    value={row.studentAnswer}
                    onChange={(e) => setRow(q.question_id, { studentAnswer: e.target.value, dirty: true })}
                    onBlur={() => {
                      // Re-grade on studentAnswer change
                      const currentRow = rows.get(q.question_id);
                      if (currentRow?.studentAnswer !== q.student_answer) {
                        void autoSave(q.question_id, currentRow?.studentAnswer);
                      }
                    }}
                    disabled={row.saving}
                    aria-label={`Student answer for question ${idx + 1}`}
                  />
                </div>

                {/* Correct answer — shown on desktop only */}
                <div className="hidden sm:block space-y-1.5">
                  <p className="text-xs font-semibold text-moss-deep">Correct answer</p>
                  <div className="min-h-[4rem] rounded-xl border border-moss/30 bg-moss-wash/40 px-3.5 py-2.5 text-sm leading-relaxed text-moss-deep">
                    {q.correct_answer ?? <span className="italic text-ink-faint">—</span>}
                  </div>
                </div>
              </div>

              {/* Marks + Feedback row */}
              <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
                <div className="space-y-1.5">
                  <label
                    htmlFor={`marks-${q.question_id}`}
                    className="block text-xs font-semibold text-ink-faint"
                  >
                    Marks
                  </label>
                  <input
                    id={`marks-${q.question_id}`}
                    type="number"
                    min={0}
                    max={q.marks}
                    step={1}
                    className={inputClass}
                    value={row.marksEarned}
                    onChange={(e) => setRow(q.question_id, { marksEarned: e.target.value, dirty: true })}
                    onBlur={() => void autoSave(q.question_id)}
                    disabled={row.saving}
                    aria-label={`Marks for question ${idx + 1}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor={`feedback-${q.question_id}`}
                    className="block text-xs font-semibold text-ink-faint"
                  >
                    Feedback
                  </label>
                  <textarea
                    id={`feedback-${q.question_id}`}
                    className={`${inputClass} min-h-[3rem] resize-y`}
                    value={row.feedback}
                    onChange={(e) => setRow(q.question_id, { feedback: e.target.value, dirty: true })}
                    onBlur={() => void autoSave(q.question_id)}
                    disabled={row.saving}
                    placeholder="Add feedback for the student…"
                    aria-label={`Feedback for question ${idx + 1}`}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
        <p className="text-sm text-ink-soft">
          Total: <span className={`font-bold ${ratioColour(totalMarks, maxMarks)}`}>{totalMarks}/{maxMarks}</span>
          {anyDirty ? <span className="ml-2 text-marigold-deep text-xs">(unsaved changes)</span> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} onClick={onClose} disabled={saving}>
            Close without saving
          </button>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => void handleSaveAll()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save attempt"}
          </button>
        </div>
      </div>
    </div>
  );
}
