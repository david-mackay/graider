"use client";

import { useRef, useState } from "react";
import { Card, btnSecondary } from "@/components/shared/ui";
import ParsePresetPicker from "@/components/shared/ParsePresetPicker";
import { handleJson } from "@/lib/dashboard-client";
import {
  defaultPresetForSurface,
  type DocumentParsePreset,
  type ParseSurface,
} from "@/lib/parse-presets";

export type ContentImportKind = "question_bank" | "test";

type PdfImportPanelProps = {
  classId: string;
  kind: ContentImportKind;
  onComplete: () => void | Promise<void>;
  onStatus: (message: string, type?: "info" | "error") => void;
  disabled?: boolean;
};

type ImportJobResponse = {
  jobId: string;
  status: string;
  result?: { questionsCreated?: number; testId?: string; testTitle?: string };
  error?: string | null;
};

const ENDPOINTS: Record<ContentImportKind, string> = {
  question_bank: "question-bank/import",
  test: "tests/import",
};

const SURFACES: Record<ContentImportKind, ParseSurface> = {
  question_bank: "question_bank_import",
  test: "test_import",
};

const LABELS: Record<ContentImportKind, { title: string; hint: string; success: (n?: number) => string }> = {
  question_bank: {
    title: "Import from PDF",
    hint: "Upload an answer key or question bank PDF — including MCQ letter keys. We’ll extract what we can.",
    success: (n) =>
      typeof n === "number" ? `Imported ${n} question${n === 1 ? "" : "s"}.` : "Question bank imported.",
  },
  test: {
    title: "Import test from PDF",
    hint: "Upload a test PDF — we’ll create a test and add its questions (open + MCQ).",
    success: (n) =>
      typeof n === "number" ? `Test imported with ${n} question${n === 1 ? "" : "s"}.` : "Test imported from PDF.",
  },
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function PdfImportPanel({
  classId,
  kind,
  onComplete,
  onStatus,
  disabled = false,
}: PdfImportPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const surface = SURFACES[kind];
  const [busy, setBusy] = useState(false);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [parsePreset, setParsePreset] = useState<DocumentParsePreset>(() =>
    defaultPresetForSurface(surface),
  );
  const labels = LABELS[kind];

  async function pollJob(jobId: string): Promise<ImportJobResponse> {
    const path = `/api/classes/${classId}/${ENDPOINTS[kind]}/${jobId}`;
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const payload = await handleJson<ImportJobResponse>(
        await fetch(path, { cache: "no-store" }),
      );
      if (payload.status === "completed" || payload.status === "failed") {
        return payload;
      }
      await sleep(2000);
    }
    throw new Error("Import is taking longer than expected. Check back in a moment.");
  }

  async function onPick(file: File | null) {
    if (!file) return;
    setBusy(true);
    setPickedName(file.name);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("parsePreset", parsePreset);
      const created = await handleJson<{ jobId: string; status: string }>(
        await fetch(`/api/classes/${classId}/${ENDPOINTS[kind]}`, {
          method: "POST",
          body: formData,
        }),
      );
      const finished = await pollJob(created.jobId);
      if (finished.status === "failed") {
        throw new Error(finished.error ?? "PDF import failed.");
      }
      onStatus(labels.success(finished.result?.questionsCreated));
      setPickedName(null);
      await onComplete();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "PDF import failed.", "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card className="border-dashed border-line bg-cream/40">
      <p className="text-sm font-semibold text-ink">{labels.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-faint">{labels.hint}</p>
      <ParsePresetPicker
        surface={surface}
        value={parsePreset}
        onChange={setParsePreset}
        disabled={disabled || busy}
        className="mt-3"
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => fileRef.current?.click()}
        className={`${btnSecondary} mt-3 w-full justify-center py-2.5 disabled:opacity-60`}
      >
        {busy ? `Processing ${pickedName ?? "PDF"}…` : "Choose PDF"}
      </button>
      {busy ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" role="status" aria-live="polite">
          <div className="progress-indeterminate-bar h-full w-2/5 rounded-full bg-pen" />
        </div>
      ) : null}
    </Card>
  );
}
