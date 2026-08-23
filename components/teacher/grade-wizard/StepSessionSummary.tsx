"use client";

import { Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import ParsePresetPicker from "@/components/shared/ParsePresetPicker";
import CopyableError from "@/components/shared/CopyableError";
import SendStopButton from "@/components/teacher/grade-wizard/SendStopButton";
import type { DocumentParsePreset } from "@/lib/parse-presets";
import type { StudentBucket } from "@/lib/student-grade";
import { totalPageCount } from "@/lib/student-grade";

type StepSessionSummaryProps = {
  buckets: StudentBucket[];
  testTitle: string;
  onParsePresetChange: (preset: DocumentParsePreset, studentId: string) => void;
  onAddStudent: () => void;
  onResumeStudent: (studentId: string) => void;
  onRemoveStudent: (studentId: string) => void;
  onSendStudent: (studentId: string) => void;
  onCancelSend: (studentId: string) => void;
  onReview: () => void;
  onBack: () => void;
  isBusy: boolean;
  readyCount: number;
  errorMessage: string;
};

export default function StepSessionSummary({
  buckets,
  testTitle,
  onParsePresetChange,
  onAddStudent,
  onResumeStudent,
  onRemoveStudent,
  onSendStudent,
  onCancelSend,
  onReview,
  onBack,
  isBusy,
  readyCount,
  errorMessage,
}: StepSessionSummaryProps) {
  const captured = buckets.filter((b) => b.pages.length > 0);
  const pageTotal = totalPageCount(captured);
  const anyoneSending = captured.some((b) => b.sendStatus === "sending");

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-display text-lg font-semibold text-ink">Session summary</h3>
        <p className="mt-1 text-sm text-ink-soft">
          {testTitle} · {captured.length} student{captured.length === 1 ? "" : "s"} ·{" "}
          {pageTotal} page{pageTotal === 1 ? "" : "s"}
          {readyCount > 0 ? ` · ${readyCount} ready` : ""}
        </p>
        <p className="mt-2 text-xs text-ink-faint">
          Send each student one at a time so uploads stay small. Document type is per student.
          Review when you&apos;re ready.
        </p>
      </Card>

      {errorMessage ? <CopyableError message={errorMessage} /> : null}

      {captured.length > 0 ? (
        <ul className="space-y-2">
          {captured.map((bucket) => (
            <li
              key={bucket.studentId}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3 shadow-paper sm:flex-row sm:items-center"
            >
              <button
                type="button"
                onClick={() => onResumeStudent(bucket.studentId)}
                disabled={bucket.sendStatus === "sending"}
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
                    {bucket.pages.length} page{bucket.pages.length === 1 ? "" : "s"}
                    {bucket.sendStatus === "ready"
                      ? " · ready"
                      : bucket.sendStatus === "sending"
                        ? " · reading…"
                        : bucket.sendStatus === "error"
                          ? " · failed — retry send"
                          : " · click to add more"}
                  </p>
                  {bucket.sendError ? (
                    <p className="mt-0.5 text-xs font-medium text-pen-deep">{bucket.sendError}</p>
                  ) : null}
                </div>
              </button>
              <ParsePresetPicker
                surface="student_ocr"
                value={bucket.parsePreset}
                onChange={(preset) => onParsePresetChange(preset, bucket.studentId)}
                disabled={bucket.sendStatus === "sending"}
                className="sm:w-52"
              />
              <SendStopButton
                status={bucket.sendStatus}
                size="md"
                disabled={bucket.pages.length === 0}
                onSend={() => onSendStudent(bucket.studentId)}
                onCancel={() => onCancelSend(bucket.studentId)}
                label={`Send ${bucket.studentName}`}
              />
              <button
                type="button"
                onClick={() => onRemoveStudent(bucket.studentId)}
                disabled={bucket.sendStatus === "sending"}
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
        disabled={anyoneSending}
        className="w-full cursor-pointer rounded-2xl border-2 border-dashed border-pen/40 bg-pen-wash/20 px-4 py-4 text-sm font-bold text-pen-deep transition-colors duration-150 hover:bg-pen-wash/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Add another student
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} disabled={anyoneSending} className={btnSecondary}>
          Back
        </button>
        <button
          type="button"
          onClick={onReview}
          disabled={isBusy || readyCount === 0}
          className={btnPrimary}
        >
          Review ready ({readyCount})
        </button>
      </div>
    </div>
  );
}
