"use client";

import { useState } from "react";
import { Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import PageStagingGrid from "@/components/shared/PageStagingGrid";
import CopyableError from "@/components/shared/CopyableError";
import { UNIFIED_PARSE_PRESET, type DocumentParsePreset } from "@/lib/parse-presets";
import type { TestSummary } from "@/lib/types";

type StepUploadStackProps = {
  selectedTest: TestSummary;
  onSubmit: (files: File[], parsePreset: DocumentParsePreset) => void | Promise<void>;
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
      setLocalError("Add at least one photo or PDF to continue.");
      return;
    }
    void onSubmit(files, UNIFIED_PARSE_PRESET);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">{selectedTest.title}</h3>
            <p className="text-xs text-ink-soft">
              Drop photos or a scanned PDF of the class set. Handwriting over printed text is read the same way for both.
            </p>
          </div>
          <span className="text-xs font-bold text-ink-faint">
            {files.length} / 10 pages
          </span>
        </div>

        <PageStagingGrid
          onFilesChange={handleFilesChange}
          maxPages={10}
          disabled={isBusy}
          dropLabel="Drag the class set in, or click to choose"
          onError={setLocalError}
        />

        {combinedError ? <CopyableError message={combinedError} className="mt-3" /> : null}
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
          {isBusy ? "Reading papers…" : "Continue to review"}
        </button>
      </div>
    </div>
  );
}
