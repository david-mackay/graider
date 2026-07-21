"use client";

import { useMemo, useState } from "react";
import { Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import PageStagingGrid from "@/components/shared/PageStagingGrid";
import { MAX_PAGES_PER_STUDENT } from "@/lib/student-grade";

type StepCapturePagesProps = {
  studentName: string;
  /** Pages already staged for this student (used to seed the grid). */
  initialPages: File[];
  onFilesChange: (pages: File[]) => void;
  onDone: () => void;
  onBack: () => void;
  pageCount: number;
  errorMessage: string;
  /** Override the label on the "Done" button. */
  doneLabel?: string;
};

export default function StepCapturePages({
  studentName,
  initialPages,
  onFilesChange,
  onDone,
  onBack,
  pageCount,
  errorMessage,
  doneLabel,
}: StepCapturePagesProps) {
  const [localError, setLocalError] = useState("");
  const combinedError = errorMessage || localError;

  // Freeze the seed to the initial value so remounting the grid on step revisit
  // keeps prior pages, without oscillating with parent state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seed = useMemo(() => initialPages, []);

  function handleFilesChange(next: File[]) {
    if (localError) setLocalError("");
    onFilesChange(next);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">{studentName}</h3>
            <p className="text-xs text-ink-soft">
              Snap or upload photos of every page for this student.
            </p>
          </div>
          <span className="text-xs font-bold text-ink-faint">
            {pageCount} / {MAX_PAGES_PER_STUDENT} pages
          </span>
        </div>

        <PageStagingGrid
          initialFiles={seed}
          onFilesChange={handleFilesChange}
          maxPages={MAX_PAGES_PER_STUDENT}
          dropLabel="Drop this student's pages, or click to choose"
          onError={setLocalError}
        />

        {combinedError ? (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-pen-soft/60 bg-pen-wash px-3.5 py-2.5 text-sm font-bold text-pen-deep"
          >
            {combinedError}
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className={btnSecondary}>
          Back
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={pageCount === 0}
          className={btnPrimary}
        >
          {doneLabel ?? `Done with ${studentName}`}
        </button>
      </div>
    </div>
  );
}
