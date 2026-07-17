"use client";

import { useState } from "react";
import { Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import PageStagingGrid from "@/components/shared/PageStagingGrid";
import type { TestSummary } from "@/lib/types";

type StepUploadStackProps = {
  selectedTest: TestSummary;
  onSubmit: (files: File[]) => void | Promise<void>;
  onBack: () => void;
  isBusy: boolean;
  errorMessage: string;
  onClearError: () => void;
};

export default function StepUploadStack({
  selectedTest,
  onSubmit,
  onBack,
  isBusy,
  errorMessage,
  onClearError,
}: StepUploadStackProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [localError, setLocalError] = useState("");

  const combinedError = errorMessage || localError;

  function handleFilesChange(next: File[]) {
    setFiles(next);
    if (localError) setLocalError("");
    if (errorMessage) onClearError();
  }

  function handleSubmit() {
    if (files.length === 0) {
      setLocalError("Add at least one image to continue.");
      return;
    }
    void onSubmit(files);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">{selectedTest.title}</h3>
            <p className="text-xs text-ink-soft">Drop the photos of your stack of papers below.</p>
          </div>
          <span className="text-xs font-bold text-ink-faint">
            {files.length} / 10 pages
          </span>
        </div>

        <PageStagingGrid
          onFilesChange={handleFilesChange}
          maxPages={10}
          disabled={isBusy}
          dropLabel="Drag the whole stack in, or click to choose"
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
        <button
          type="button"
          onClick={onBack}
          disabled={isBusy}
          className={btnSecondary}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isBusy || files.length === 0}
          className={btnPrimary}
        >
          {isBusy ? "Reading handwriting…" : "Continue to review"}
        </button>
      </div>
    </div>
  );
}
