"use client";

import { FormEvent } from "react";
import { Card, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
import type { TestDetail } from "@/lib/types";

type TestTakingFormProps = {
  test: TestDetail;
  answers: Record<string, string>;
  onChangeAnswer: (questionId: string, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  isBusy: boolean;
};

export default function TestTakingForm({
  test,
  answers,
  onChangeAnswer,
  onSubmit,
  onClose,
  isBusy,
}: TestTakingFormProps) {
  const totalMarks = test.questions.reduce((sum, q) => sum + q.marks, 0);

  return (
    <div className="fixed inset-0 z-50 bg-[#f5f3ff] overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">In progress</p>
            <h2 className="mt-0.5 text-xl font-bold text-indigo-950">{test.title}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {test.questions.length} question{test.questions.length !== 1 ? "s" : ""} · {totalMarks} marks
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-indigo-50 transition-colors duration-150"
          >
            Exit test
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          {test.questions.map((q, i) => (
            <Card key={q.question_id} className="border-indigo-100">
              <label className="block">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                    Question {i + 1}
                  </span>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">
                    {q.marks} mark{q.marks !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-base font-semibold text-indigo-950 leading-relaxed">{q.prompt}</p>
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
            <div className="flex gap-3 rounded-2xl border border-indigo-200 bg-white/90 backdrop-blur-sm p-3 shadow-lg shadow-indigo-100">
              <button className={`${btnPrimary} flex-1 justify-center py-3`} type="submit" disabled={isBusy}>
                {isBusy ? "Submitting…" : "Submit test"}
              </button>
              <button className={btnSecondary} type="button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
