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
  /** When set (test imports), merge into this existing test instead of creating a new one. */
  targetTestId?: string | null;
  /** Allow selecting multiple PDFs (e.g. questions + answer key) in one import. */
  multiple?: boolean;
  titleOverride?: string;
  hintOverride?: string;
};

type ImportJobResponse = {
  jobId: string;
  status: string;
  result?: {
    questionsCreated?: number;
    questionsUpdated?: number;
    questionsMatched?: number;
    testId?: string;
    testTitle?: string;
    enriched?: boolean;
  };
  error?: string | null;
};

type ActiveImport = {
  clientId: string;
  label: string;
  phase: "uploading" | "processing";
};

const ENDPOINTS: Record<ContentImportKind, string> = {
  question_bank: "question-bank/import",
  test: "tests/import",
};

const SURFACES: Record<ContentImportKind, ParseSurface> = {
  question_bank: "question_bank_import",
  test: "test_import",
};

function defaultLabels(
  kind: ContentImportKind,
  enriched: boolean,
): { title: string; hint: string; success: (result?: ImportJobResponse["result"]) => string } {
  if (kind === "question_bank") {
    return {
      title: "Import from PDF",
      hint: "Upload an answer key or question bank PDF — including MCQ letter keys. We’ll extract what we can. You can start another upload while one is processing.",
      success: (result) =>
        typeof result?.questionsCreated === "number"
          ? `Imported ${result.questionsCreated} question${result.questionsCreated === 1 ? "" : "s"}.`
          : "Question bank imported.",
    };
  }
  if (enriched) {
    return {
      title: "Add PDF to this test",
      hint: "Upload questions, an answer key, or both. We’ll match by question number and fill in missing prompts or answers. Uploads can run in parallel.",
      success: (result) => {
        const updated = result?.questionsUpdated ?? 0;
        const created = result?.questionsCreated ?? 0;
        const parts: string[] = [];
        if (updated) parts.push(`updated ${updated}`);
        if (created) parts.push(`added ${created}`);
        return parts.length
          ? `Merged into test (${parts.join(", ")}).`
          : "Merged PDF into test.";
      },
    };
  }
  return {
    title: "Import test from PDF",
    hint: "Upload one or more PDFs (questions and/or answer key). We’ll create a draft test and merge overlapping items by question number. You can start another import while one is processing.",
    success: (result) =>
      typeof result?.questionsCreated === "number"
        ? `Test imported with ${result.questionsCreated} question${result.questionsCreated === 1 ? "" : "s"}.`
        : "Test imported from PDF.",
  };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function PdfImportPanel({
  classId,
  kind,
  onComplete,
  onStatus,
  disabled = false,
  targetTestId = null,
  multiple = kind === "test",
  titleOverride,
  hintOverride,
}: PdfImportPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const surface = SURFACES[kind];
  const [activeImports, setActiveImports] = useState<ActiveImport[]>([]);
  const [parsePreset, setParsePreset] = useState<DocumentParsePreset>(() =>
    defaultPresetForSurface(surface),
  );
  const labels = defaultLabels(kind, Boolean(targetTestId));
  const title = titleOverride ?? labels.title;
  const hint = hintOverride ?? labels.hint;

  function updateImport(clientId: string, patch: Partial<ActiveImport>) {
    setActiveImports((prev) =>
      prev.map((job) => (job.clientId === clientId ? { ...job, ...patch } : job)),
    );
  }

  function removeImport(clientId: string) {
    setActiveImports((prev) => prev.filter((job) => job.clientId !== clientId));
  }

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

  async function runImport(files: File[], preset: DocumentParsePreset) {
    const clientId = nextClientId();
    const label = files.length === 1 ? files[0]!.name : `${files.length} PDFs`;
    setActiveImports((prev) => [...prev, { clientId, label, phase: "uploading" }]);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("pdfs", file);
        formData.append("pdf", file); // backward-compat for single-file endpoints
      }
      formData.append("parsePreset", preset);
      if (targetTestId) formData.append("targetTestId", targetTestId);

      const created = await handleJson<{ jobId: string; status: string }>(
        await fetch(`/api/classes/${classId}/${ENDPOINTS[kind]}`, {
          method: "POST",
          body: formData,
        }),
      );

      updateImport(clientId, { phase: "processing" });
      const finished = await pollJob(created.jobId);
      if (finished.status === "failed") {
        throw new Error(finished.error ?? "PDF import failed.");
      }
      onStatus(labels.success(finished.result));
      await onComplete();
    } catch (error) {
      onStatus(
        error instanceof Error ? `${label}: ${error.message}` : `${label}: PDF import failed.`,
        "error",
      );
    } finally {
      removeImport(clientId);
    }
  }

  function onPick(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;
    // Clear immediately so another file can be chosen while this import runs.
    if (fileRef.current) fileRef.current.value = "";
    void runImport(files, parsePreset);
  }

  return (
    <Card className="border-dashed border-line bg-cream/40">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-faint">{hint}</p>
      <ParsePresetPicker
        surface={surface}
        value={parsePreset}
        onChange={setParsePreset}
        disabled={disabled}
        className="mt-3"
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        className="sr-only"
        onChange={(e) => onPick(e.target.files)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
        className={`${btnSecondary} mt-3 w-full justify-center py-2.5 disabled:opacity-60`}
      >
        {activeImports.length > 0
          ? multiple
            ? "Add another PDF (or set)"
            : "Add another PDF"
          : multiple
            ? "Choose PDF(s)"
            : "Choose PDF"}
      </button>
      {activeImports.length > 0 ? (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {activeImports.map((job) => (
            <li key={job.clientId} className="rounded-lg border border-line-soft bg-paper px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-ink">{job.label}</p>
                <p className="shrink-0 text-[11px] text-ink-faint">
                  {job.phase === "uploading" ? "Uploading…" : "Processing…"}
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="status">
                <div className="progress-indeterminate-bar h-full w-2/5 rounded-full bg-pen" />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
