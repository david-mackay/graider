"use client";

import { useEffect, useState } from "react";
import { Card, FormField, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import { IconX } from "@/components/shared/icons";
import { handleJson } from "@/lib/dashboard-client";
import type { TestDetail, TestQuestion } from "@/lib/types";

type EditableQuestion = {
  question_id: string;
  prompt: string;
  correct_answer: string;
  marks: number;
  dirty: boolean;
  saving: boolean;
};

type TestViewEditorProps = {
  test: TestDetail;
  onClose: () => void;
  onStatus: (message: string, type?: "info" | "error") => void;
  onChanged: () => void | Promise<void>;
  isBusy: boolean;
  setBusy: (value: boolean) => void;
};

function toEditable(questions: TestQuestion[]): EditableQuestion[] {
  return questions.map((q) => ({
    question_id: q.question_id,
    prompt: q.prompt,
    correct_answer: q.correct_answer ?? "",
    marks: q.marks,
    dirty: false,
    saving: false,
  }));
}

export default function TestViewEditor({
  test,
  onClose,
  onStatus,
  onChanged,
  isBusy,
  setBusy,
}: TestViewEditorProps) {
  const [title, setTitle] = useState(test.title);
  const [titleDirty, setTitleDirty] = useState(false);
  const [rows, setRows] = useState<EditableQuestion[]>(() => toEditable(test.questions));

  useEffect(() => {
    setTitle(test.title);
    setTitleDirty(false);
    setRows(toEditable(test.questions));
  }, [test]);

  function patchRow(questionId: string, patch: Partial<EditableQuestion>) {
    setRows((prev) =>
      prev.map((row) =>
        row.question_id === questionId ? { ...row, ...patch, dirty: true } : row,
      ),
    );
  }

  async function saveTitle() {
    const next = title.trim();
    if (!next) {
      onStatus("Test title is required.", "error");
      return;
    }
    setBusy(true);
    try {
      await handleJson(
        await fetch(`/api/tests/${test.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: next }),
        }),
      );
      setTitleDirty(false);
      onStatus("Test title saved.");
      await onChanged();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to save title.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveQuestion(row: EditableQuestion) {
    const prompt = row.prompt.trim();
    const correctAnswer = row.correct_answer.trim();
    const marks = Number(row.marks);
    if (!prompt) {
      onStatus("Question prompt is required.", "error");
      return;
    }
    if (!correctAnswer) {
      onStatus("Correct answer is required.", "error");
      return;
    }
    if (!Number.isFinite(marks) || marks < 0) {
      onStatus("Marks must be a non-negative number.", "error");
      return;
    }

    setRows((prev) =>
      prev.map((r) => (r.question_id === row.question_id ? { ...r, saving: true } : r)),
    );
    try {
      await handleJson(
        await fetch(`/api/questions/${row.question_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            class_id: test.class_id,
            prompt,
            correct_answer: correctAnswer,
            marks,
          }),
        }),
      );
      setRows((prev) =>
        prev.map((r) =>
          r.question_id === row.question_id
            ? { ...r, prompt, correct_answer: correctAnswer, marks, dirty: false, saving: false }
            : r,
        ),
      );
      onStatus("Question saved.");
      await onChanged();
    } catch (error) {
      setRows((prev) =>
        prev.map((r) => (r.question_id === row.question_id ? { ...r, saving: false } : r)),
      );
      onStatus(error instanceof Error ? error.message : "Failed to save question.", "error");
    }
  }

  async function saveAll() {
    if (titleDirty) await saveTitle();
    for (const row of rows) {
      if (row.dirty) await saveQuestion(row);
    }
  }

  const anyDirty = titleDirty || rows.some((r) => r.dirty);

  return (
    <Card className="border-ink-faint">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">View test</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <FormField label="Title">
              <input
                className={inputClass}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleDirty(true);
                }}
                disabled={isBusy}
              />
            </FormField>
            {titleDirty ? (
              <button
                type="button"
                className={btnSecondary}
                disabled={isBusy}
                onClick={() => void saveTitle()}
              >
                Save title
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {anyDirty ? (
            <button type="button" className={btnPrimary} disabled={isBusy} onClick={() => void saveAll()}>
              Save all
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-ink-faint transition-colors duration-150 hover:bg-cream"
            aria-label="Close view"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.question_id} className="rounded-xl border border-line-soft bg-cream p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Question {index + 1}
                {row.dirty ? " · unsaved" : ""}
              </p>
              <button
                type="button"
                className={btnSecondary}
                disabled={isBusy || row.saving || !row.dirty}
                onClick={() => void saveQuestion(row)}
              >
                {row.saving ? "Saving…" : "Save"}
              </button>
            </div>
            <div className="grid gap-3">
              <FormField label="Prompt">
                <textarea
                  className={`${inputClass} min-h-[4.5rem]`}
                  value={row.prompt}
                  onChange={(e) => patchRow(row.question_id, { prompt: e.target.value })}
                  disabled={isBusy || row.saving}
                />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                <FormField label="Correct answer">
                  <textarea
                    className={`${inputClass} min-h-[3.5rem]`}
                    value={row.correct_answer}
                    onChange={(e) => patchRow(row.question_id, { correct_answer: e.target.value })}
                    disabled={isBusy || row.saving}
                  />
                </FormField>
                <FormField label="Marks">
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    step={1}
                    value={row.marks}
                    onChange={(e) =>
                      patchRow(row.question_id, { marks: Number(e.target.value) || 0 })
                    }
                    disabled={isBusy || row.saving}
                  />
                </FormField>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
