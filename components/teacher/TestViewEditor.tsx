"use client";

import { useEffect, useState } from "react";
import { Badge, Card, FormField, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import { IconX } from "@/components/shared/icons";
import { handleJson } from "@/lib/dashboard-client";
import { resolveMcqChoices, type McqChoice } from "@/lib/mcq-choices";
import type { TestDetail, TestQuestion } from "@/lib/types";

type EditableQuestion = {
  question_id: string;
  prompt: string;
  correct_answer: string;
  marks: number;
  question_type: "open" | "mcq";
  choices: McqChoice[];
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

const LETTERS = ["A", "B", "C", "D", "E"] as const;

function nextChoiceKey(existing: McqChoice[]): string | null {
  for (const letter of LETTERS) {
    if (!existing.some((c) => c.key === letter)) return letter;
  }
  return null;
}

function toEditable(questions: TestQuestion[]): EditableQuestion[] {
  return questions.map((q) => {
    const questionType = q.question_type === "mcq" ? "mcq" : "open";
    const resolved =
      questionType === "mcq"
        ? resolveMcqChoices({
            prompt: q.prompt,
            question_type: "mcq",
            choices: q.choices,
          }) ?? LETTERS.map((key) => ({ key, text: "" }))
        : [];
    return {
      question_id: q.question_id,
      prompt: q.prompt,
      correct_answer: q.correct_answer ?? "",
      marks: q.marks,
      question_type: questionType,
      choices: resolved.map((c) => ({
        key: c.key,
        text: c.text === c.key ? "" : c.text,
      })),
      dirty: false,
      saving: false,
    };
  });
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

  function setChoice(questionId: string, key: string, text: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.question_id !== questionId) return row;
        return {
          ...row,
          dirty: true,
          choices: row.choices.map((c) => (c.key === key ? { ...c, text } : c)),
        };
      }),
    );
  }

  function addChoice(questionId: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.question_id !== questionId) return row;
        const key = nextChoiceKey(row.choices);
        if (!key) return row;
        return {
          ...row,
          dirty: true,
          question_type: "mcq",
          choices: [...row.choices, { key, text: "" }],
        };
      }),
    );
  }

  function removeChoice(questionId: string, key: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.question_id !== questionId) return row;
        const choices = row.choices.filter((c) => c.key !== key);
        const correct =
          row.correct_answer.trim().toUpperCase() === key ? "" : row.correct_answer;
        return {
          ...row,
          dirty: true,
          choices,
          correct_answer: correct,
          question_type: choices.length > 0 ? "mcq" : row.question_type,
        };
      }),
    );
  }

  function convertToMcq(questionId: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.question_id !== questionId) return row;
        return {
          ...row,
          dirty: true,
          question_type: "mcq",
          choices:
            row.choices.length > 0
              ? row.choices
              : LETTERS.slice(0, 4).map((key) => ({ key, text: "" })),
          correct_answer: row.correct_answer.trim().toUpperCase().slice(0, 1),
        };
      }),
    );
  }

  function convertToOpen(questionId: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.question_id === questionId
          ? { ...row, dirty: true, question_type: "open", choices: [] }
          : row,
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

    const isMcq = row.question_type === "mcq";
    const choices = isMcq
      ? row.choices
          .map((c) => ({ key: c.key.toUpperCase(), text: c.text.trim() }))
          .filter((c) => /^[A-E]$/.test(c.key))
      : null;

    if (isMcq) {
      if (!choices || choices.length < 2) {
        onStatus("MCQ questions need at least two choices.", "error");
        return;
      }
      if (choices.some((c) => !c.text)) {
        onStatus("Fill in text for every MCQ choice.", "error");
        return;
      }
      const letter = correctAnswer.toUpperCase().slice(0, 1);
      if (!choices.some((c) => c.key === letter)) {
        onStatus("Correct answer must match one of the choice letters.", "error");
        return;
      }
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
            correct_answer: isMcq ? correctAnswer.toUpperCase().slice(0, 1) : correctAnswer,
            marks,
            question_type: row.question_type,
            choices,
          }),
        }),
      );
      setRows((prev) =>
        prev.map((r) =>
          r.question_id === row.question_id
            ? {
                ...r,
                prompt,
                correct_answer: isMcq ? correctAnswer.toUpperCase().slice(0, 1) : correctAnswer,
                marks,
                choices: choices ?? [],
                dirty: false,
                saving: false,
              }
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
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Question {index + 1}
                  {row.dirty ? " · unsaved" : ""}
                </p>
                <Badge variant={row.question_type === "mcq" ? "blue" : "gray"}>
                  {row.question_type === "mcq" ? "MCQ" : "Open"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {row.question_type === "mcq" ? (
                  <button
                    type="button"
                    className="cursor-pointer text-xs font-medium text-ink-faint underline decoration-line underline-offset-2 hover:text-pen"
                    disabled={isBusy || row.saving}
                    onClick={() => convertToOpen(row.question_id)}
                  >
                    Switch to open
                  </button>
                ) : (
                  <button
                    type="button"
                    className="cursor-pointer text-xs font-medium text-ink-faint underline decoration-line underline-offset-2 hover:text-pen"
                    disabled={isBusy || row.saving}
                    onClick={() => convertToMcq(row.question_id)}
                  >
                    Switch to MCQ
                  </button>
                )}
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={isBusy || row.saving || !row.dirty}
                  onClick={() => void saveQuestion(row)}
                >
                  {row.saving ? "Saving…" : "Save"}
                </button>
              </div>
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

              {row.question_type === "mcq" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      Choices
                    </p>
                    {row.choices.length < 5 ? (
                      <button
                        type="button"
                        className="cursor-pointer text-xs font-bold text-pen hover:underline"
                        disabled={isBusy || row.saving}
                        onClick={() => addChoice(row.question_id)}
                      >
                        + Add choice
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {row.choices.map((choice) => (
                      <div key={choice.key} className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-sm font-bold text-pen">{choice.key}.</span>
                        <input
                          className={`${inputClass} flex-1`}
                          value={choice.text}
                          onChange={(e) => setChoice(row.question_id, choice.key, e.target.value)}
                          placeholder={`Option ${choice.key}`}
                          disabled={isBusy || row.saving}
                        />
                        {row.choices.length > 2 ? (
                          <button
                            type="button"
                            className="cursor-pointer px-2 text-xs text-ink-faint hover:text-pen"
                            disabled={isBusy || row.saving}
                            onClick={() => removeChoice(row.question_id, choice.key)}
                            aria-label={`Remove choice ${choice.key}`}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                    <FormField label="Correct letter" hint="Must match one of the choices above">
                      <select
                        className={inputClass}
                        value={row.correct_answer.trim().toUpperCase().slice(0, 1)}
                        onChange={(e) =>
                          patchRow(row.question_id, { correct_answer: e.target.value })
                        }
                        disabled={isBusy || row.saving}
                      >
                        <option value="">Select…</option>
                        {row.choices.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.key}
                            {c.text ? ` — ${c.text.slice(0, 60)}` : ""}
                          </option>
                        ))}
                      </select>
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
              ) : (
                <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                  <FormField label="Correct answer">
                    <textarea
                      className={`${inputClass} min-h-[3.5rem]`}
                      value={row.correct_answer}
                      onChange={(e) =>
                        patchRow(row.question_id, { correct_answer: e.target.value })
                      }
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
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
