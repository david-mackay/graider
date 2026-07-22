"use client";

import { useState } from "react";
import { Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import type { GradedAttemptDetail } from "@/lib/dashboard-types";
import {
  generateAttemptPdf,
  openPdfPreview,
  openPrintPreview,
  buildGradeHtml,
  sharePdfBlob,
  type GradePdfOptions,
} from "@/lib/export-grade-pdf";

type ExportGradePdfButtonProps = {
  attempt?: GradedAttemptDetail | null;
  attemptId?: string;
  studentName?: string | null;
  fetchAttempt?: (attemptId: string) => Promise<GradedAttemptDetail>;
  label?: string;
  compact?: boolean;
};

type ModalStep = "options" | "preview";

export default function ExportGradePdfButton({
  attempt,
  attemptId,
  studentName,
  fetchAttempt,
  label = "Export PDF",
  compact = false,
}: ExportGradePdfButtonProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<ModalStep>("options");
  const [includeGrade, setIncludeGrade] = useState(true);
  const [includeFeedback, setIncludeFeedback] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState<GradedAttemptDetail | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  function resetState() {
    setStep("options");
    setBusy(false);
    setError(null);
    setPreviewAttempt(null);
    setPdfBlob(null);
    setPdfFilename(null);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  }

  function closeModal() {
    setVisible(false);
    resetState();
  }

  function openModal() {
    resetState();
    setVisible(true);
  }

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      const options: GradePdfOptions = { includeGrade, includeFeedback, studentName };
      let detail = attempt ?? null;
      if (!detail && attemptId && fetchAttempt) {
        detail = await fetchAttempt(attemptId);
      }
      if (!detail) {
        throw new Error("Missing graded paper details.");
      }

      const file = await generateAttemptPdf(detail, options);
      setPreviewAttempt(detail);
      setPdfBlob(file.blob);
      setPdfFilename(file.filename);
      setPdfUrl(file.url);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate PDF.");
    } finally {
      setBusy(false);
    }
  }

  function handleOpenPreview() {
    try {
      if (pdfUrl) {
        openPdfPreview(pdfUrl);
        return;
      }
      if (!previewAttempt) return;
      openPrintPreview(
        buildGradeHtml(previewAttempt, { includeGrade, includeFeedback, studentName }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open PDF preview.");
    }
  }

  async function handleShare() {
    if (!pdfBlob || !pdfFilename) return;
    setBusy(true);
    setError(null);
    try {
      await sharePdfBlob(pdfBlob, pdfFilename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share PDF.");
    } finally {
      setBusy(false);
    }
  }

  const displayName =
    studentName?.trim() || previewAttempt?.student_name?.trim() || "this student";

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={
          compact
            ? "cursor-pointer rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-pen-deep transition-colors duration-150 hover:bg-cream"
            : `${btnSecondary}`
        }
      >
        {label}
      </button>

      {visible ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-pdf-title"
        >
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto border-line shadow-lifted">
            {step === "options" ? (
              <>
                <h2 id="export-pdf-title" className="font-display text-xl font-semibold text-ink">
                  Send graded paper
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Choose what to include, then preview before sharing with {displayName}.
                </p>

                <div className="mt-4 space-y-3 rounded-xl border border-line bg-cream/40 p-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-ink">
                    <span>Include overall grade</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-faint text-pen focus:ring-pen"
                      checked={includeGrade}
                      onChange={(e) => setIncludeGrade(e.target.checked)}
                      disabled={busy}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-ink">
                    <span>Include feedback</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-faint text-pen focus:ring-pen"
                      checked={includeFeedback}
                      onChange={(e) => setIncludeFeedback(e.target.checked)}
                      disabled={busy}
                    />
                  </label>
                </div>

                {error ? (
                  <p className="mt-3 rounded-lg border border-pen-soft/60 bg-pen-wash px-3 py-2 text-sm text-pen-deep">
                    {error}
                  </p>
                ) : null}

                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void handleGenerate()}
                    disabled={busy}
                    className={`${btnPrimary} justify-center py-3 disabled:opacity-60`}
                  >
                    {busy ? "Generating…" : "Generate PDF"}
                  </button>
                  <button type="button" onClick={closeModal} className={`${btnSecondary} justify-center py-3`}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="export-pdf-title" className="font-display text-xl font-semibold text-ink">
                  Preview PDF
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Review the graded paper, then share or download.
                </p>

                <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-xl border border-line bg-cream/30 p-4">
                  <p className="text-lg font-semibold text-ink">
                    {previewAttempt?.test_title ?? "Graded paper"}
                  </p>
                  <p className="text-sm text-ink-soft">{displayName}</p>
                  {includeGrade &&
                  previewAttempt?.total_marks != null &&
                  previewAttempt?.max_marks != null ? (
                    <p className="text-2xl font-bold text-pen">
                      {previewAttempt.total_marks}
                      <span className="text-sm font-normal text-ink-faint">
                        {" "}
                        / {previewAttempt.max_marks}
                      </span>
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    {(previewAttempt?.questions ?? []).map((question, index) => (
                      <div
                        key={question.question_id}
                        className="rounded-xl border border-line bg-paper px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                            Question {index + 1}
                          </p>
                          {includeGrade && question.marks_earned != null ? (
                            <p className="text-sm font-bold text-pen-deep">
                              {question.marks_earned}/{question.marks}
                            </p>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-ink">{question.prompt}</p>
                        <p className="mt-2 text-sm text-ink-soft">
                          Answer: {question.student_answer || "—"}
                        </p>
                        {includeFeedback && question.feedback ? (
                          <p className="mt-2 text-xs text-moss-deep">{question.feedback}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                {error ? (
                  <p className="mt-3 rounded-lg border border-pen-soft/60 bg-pen-wash px-3 py-2 text-sm text-pen-deep">
                    {error}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void handleShare()}
                    disabled={busy}
                    className={`${btnPrimary} justify-center py-3 disabled:opacity-60`}
                  >
                    {busy ? "Sharing…" : "Share PDF"}
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenPreview}
                    className={`${btnSecondary} justify-center py-3`}
                  >
                    Open PDF / print
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("options");
                      setError(null);
                    }}
                    className="cursor-pointer py-2 text-sm font-medium text-ink-soft hover:text-ink"
                  >
                    Back to options
                  </button>
                </div>
              </>
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}
