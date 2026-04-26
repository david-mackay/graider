"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import OnboardingShell from "@/components/marketing/OnboardingShell";
import { Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import { IconClipboard, IconX } from "@/components/shared/icons";
import { getVault, setVault } from "@/lib/onboarding/vault";

const MAX_BYTES = 8 * 1024 * 1024;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file."));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export default function OnboardingUploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Guard: must have answerKey to be here.
  useEffect(() => {
    const vault = getVault();
    if (!vault?.answerKey) {
      router.replace("/onboarding/answer-key");
    }
  }, [router]);

  // Manage object URL lifetime.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!next.type.startsWith("image/")) {
      setError("Upload an image (JPG or PNG).");
      return;
    }
    if (next.size > MAX_BYTES) {
      setError("Image must be under 8 MB.");
      return;
    }
    setFile(next);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null;
    pickFile(next);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const next = e.dataTransfer.files?.[0] ?? null;
    pickFile(next);
  }

  async function onContinue() {
    if (!file) return;
    setIsBusy(true);
    setError(null);
    try {
      const base64 = await readFileAsBase64(file);
      setVault({
        studentPaper: {
          mimeType: file.type || "image/png",
          base64,
          filename: file.name,
        },
        // Re-uploading invalidates a previous sampleGrade; let result/ recompute.
        sampleGrade: undefined,
      });
      router.push("/onboarding/result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the image.");
      setIsBusy(false);
    }
  }

  return (
    <OnboardingShell step={4} backHref="/onboarding/answer-key">
      <div className="text-center">
        <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-xl shadow-indigo-300/40">
          <IconClipboard className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-indigo-950 sm:text-4xl">
          Now drop a photo of your student&rsquo;s answer.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-slate-500">
          JPG or PNG. We&rsquo;ll read the handwriting for you.
        </p>
      </div>

      <div className="mt-8">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors duration-150 ${
            isDragging
              ? "border-indigo-500 bg-indigo-50"
              : "border-indigo-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            className="sr-only"
            onChange={onInputChange}
          />
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={file?.name ?? "Selected paper"}
              className="max-h-64 rounded-lg border border-indigo-100 shadow-sm"
            />
          ) : (
            <>
              <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
              </span>
              <p className="text-sm font-semibold text-indigo-950">
                Drop a photo here, or click to choose
              </p>
              <p className="mt-1 text-xs text-slate-400">JPG or PNG · up to 8 MB</p>
            </>
          )}
        </label>

        {file ? (
          <Card className="mt-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-indigo-950">{file.name}</p>
                <p className="text-xs text-slate-400">
                  {(file.size / 1024).toFixed(0)} KB · {file.type || "image"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
                aria-label="Remove file"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={btnSecondary}
          >
            {file ? "Change photo" : "Choose a file"}
          </button>
          <button
            type="button"
            onClick={() => void onContinue()}
            disabled={!file || isBusy}
            className={`${btnPrimary} justify-center`}
          >
            {isBusy ? "Reading…" : "Grade this paper"}
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}
