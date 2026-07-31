"use client";

import { useMemo, useState } from "react";
import { Card, btnSecondary } from "@/components/shared/ui";
import PageStagingGrid from "@/components/shared/PageStagingGrid";
import CopyableError from "@/components/shared/CopyableError";
import SendStopButton from "@/components/teacher/grade-wizard/SendStopButton";
import { MAX_PAGES_PER_STUDENT, type StudentSendStatus } from "@/lib/student-grade";

type StepCapturePagesProps = {
  studentName: string;
  /** Pages already staged for this student (used to seed the grid). */
  initialPages: File[];
  onFilesChange: (pages: File[]) => void;
  onSend: () => void;
  onCancelSend: () => void;
  onSaveForLater: () => void;
  onBack: () => void;
  pageCount: number;
  sendStatus: StudentSendStatus;
  sendError: string | null;
  errorMessage: string;
};

export default function StepCapturePages({
  studentName,
  initialPages,
  onFilesChange,
  onSend,
  onCancelSend,
  onSaveForLater,
  onBack,
  pageCount,
  sendStatus,
  sendError,
  errorMessage,
}: StepCapturePagesProps) {
  const [localError, setLocalError] = useState("");
  const combinedError = errorMessage || sendError || localError;
  const isSending = sendStatus === "sending";

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
              Snap photos or drop a scanned PDF of this student&apos;s paper, then send.
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

        {combinedError ? <CopyableError message={combinedError} className="mt-3" /> : null}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} disabled={isSending} className={btnSecondary}>
          Back
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSaveForLater}
            disabled={pageCount === 0 || isSending}
            className={btnSecondary}
          >
            Save for later
          </button>
          <SendStopButton
            status={sendStatus}
            disabled={pageCount === 0}
            onSend={onSend}
            onCancel={onCancelSend}
            label={`Send ${studentName}`}
          />
        </div>
      </div>
    </div>
  );
}
