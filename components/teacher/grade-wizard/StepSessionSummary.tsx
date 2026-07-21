"use client";

import { Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import ParsePresetPicker from "@/components/shared/ParsePresetPicker";
import type { DocumentParsePreset } from "@/lib/parse-presets";
import type { StudentBucket } from "@/lib/student-grade";
import { totalPageCount } from "@/lib/student-grade";

type StepSessionSummaryProps = {
  buckets: StudentBucket[];
  testTitle: string;
  parsePreset: DocumentParsePreset;
  onParsePresetChange: (preset: DocumentParsePreset) => void;
  onAddStudent: () => void;
  onResumeStudent: (studentId: string) => void;
  onRemoveStudent: (studentId: string) => void;
  onGradeAll: () => void;
  onBack: () => void;
  isBusy: boolean;
  errorMessage: string;
};

export default function StepSessionSummary({
  buckets,
  testTitle,
  parsePreset,
  onParsePresetChange,
  onAddStudent,
  onResumeStudent,
  onRemoveStudent,
  onGradeAll,
  onBack,
  isBusy,
  errorMessage,
}: StepSessionSummaryProps) {
  const captured = buckets.filter((b) => b.pages.length > 0);
  const pageTotal = totalPageCount(captured);

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-display text-lg font-semibold text-ink">Session summary</h3>
        <p className="mt-1 text-sm text-ink-soft">
          {testTitle} · {captured.length} student{captured.length === 1 ? "" : "s"} ·{" "}
          {pageTotal} page{pageTotal === 1 ? "" : "s"}
        </p>
      </Card>

      <Card>
        <ParsePresetPicker
          surface="grade_stack"
          value={parsePreset}
          onChange={onParsePresetChange}
          disabled={isBusy}
        />
      </Card>

      {errorMessage ? (
        <Card className="border-pen-soft/60 bg-pen-wash">
          <p className="text-sm font-bold text-pen-deep">{errorMessage}</p>
        </Card>
      ) : null}

      {captured.length > 0 ? (
        <ul className="space-y-2">
          {captured.map((bucket) => (
            <li
              key={bucket.studentId}
              className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-3 shadow-paper"
            >
              <button
                type="button"
                onClick={() => onResumeStudent(bucket.studentId)}
                disabled={isBusy}
                className="flex flex-1 items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-pen-wash font-display text-sm font-bold text-pen-deep">
                  {bucket.studentName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-semibold text-ink">
                    {bucket.studentName}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {bucket.pages.length} page{bucket.pages.length === 1 ? "" : "s"} · click to add more
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onRemoveStudent(bucket.studentId)}
                disabled={isBusy}
                className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold text-ink-soft transition-colors duration-150 hover:text-pen disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={onAddStudent}
        disabled={isBusy}
        className="w-full cursor-pointer rounded-2xl border-2 border-dashed border-pen/40 bg-pen-wash/20 px-4 py-4 text-sm font-bold text-pen-deep transition-colors duration-150 hover:bg-pen-wash/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Add another student
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} disabled={isBusy} className={btnSecondary}>
          Back
        </button>
        <button
          type="button"
          onClick={onGradeAll}
          disabled={isBusy || captured.length === 0}
          className={btnPrimary}
        >
          {isBusy ? "Reading pages…" : `Grade all (${captured.length})`}
        </button>
      </div>
    </div>
  );
}
