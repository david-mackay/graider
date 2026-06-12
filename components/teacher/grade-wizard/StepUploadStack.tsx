"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import { IconX } from "@/components/shared/icons";
import type { TestSummary } from "@/lib/types";

const MAX_IMAGES = 10;
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png"];

type StepUploadStackProps = {
  selectedTest: TestSummary;
  onSubmit: (files: File[]) => void | Promise<void>;
  onBack: () => void;
  isBusy: boolean;
  errorMessage: string;
  onClearError: () => void;
};

type StagedFile = {
  id: string;
  file: File;
  previewUrl: string;
};

export default function StepUploadStack({
  selectedTest,
  onSubmit,
  onBack,
  isBusy,
  errorMessage,
  onClearError,
}: StepUploadStackProps) {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      for (const item of staged) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const combinedError = errorMessage || localError;

  function clearErrors() {
    setLocalError("");
    if (errorMessage) onClearError();
  }

  function addFiles(incoming: File[]) {
    clearErrors();

    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of incoming) {
      if (!ACCEPTED_TYPES.includes(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) {
        rejected.push(file.name);
        continue;
      }
      accepted.push(file);
    }

    if (rejected.length > 0) {
      setLocalError(`These files are not JPG or PNG: ${rejected.join(", ")}`);
    }

    setStaged((prev) => {
      const remaining = MAX_IMAGES - prev.length;
      if (remaining <= 0) {
        setLocalError(`You can upload at most ${MAX_IMAGES} images at a time.`);
        return prev;
      }
      const toAdd = accepted.slice(0, remaining);
      if (accepted.length > toAdd.length) {
        setLocalError(`Only the first ${MAX_IMAGES} images were added.`);
      }
      const next: StagedFile[] = toAdd.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...next];
    });
  }

  function removeStaged(id: string) {
    setStaged((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }

  function clearAll() {
    for (const item of staged) URL.revokeObjectURL(item.previewUrl);
    setStaged([]);
    clearErrors();
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    if (isBusy) return;
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) addFiles(files);
  }

  function handleSubmit() {
    if (staged.length === 0) {
      setLocalError("Add at least one image to continue.");
      return;
    }
    void onSubmit(staged.map((s) => s.file));
  }

  const submitDisabled = useMemo(
    () => isBusy || staged.length === 0,
    [isBusy, staged.length],
  );

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">{selectedTest.title}</h3>
            <p className="text-xs text-ink-soft">Drop the photos of your stack of papers below.</p>
          </div>
          <span className="text-xs font-bold text-ink-faint">
            {staged.length} / {MAX_IMAGES} pages
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isBusy) setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 ${
            dragActive
              ? "border-pen bg-pen-wash"
              : "border-line bg-cream/60 hover:border-ink-faint hover:bg-cream"
          }`}
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-paper shadow-paper">
            <svg
              className="h-6 w-6 text-pen"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9 4.5-4.5m0 0 4.5 4.5m-4.5-4.5v13.5"
              />
            </svg>
          </div>
          <p className="text-sm font-bold text-ink">
            Drag the whole stack in, or click to choose
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            JPG or PNG. Up to {MAX_IMAGES} pages per stack.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) addFiles(files);
              e.target.value = "";
            }}
          />
        </div>

        {combinedError ? (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-pen-soft/60 bg-pen-wash px-3.5 py-2.5 text-sm font-bold text-pen-deep"
          >
            {combinedError}
          </div>
        ) : null}

        {staged.length > 0 ? (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-faint">
                Pages ready ({staged.length})
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="cursor-pointer text-xs font-bold text-ink-soft hover:text-pen transition-colors duration-150"
                disabled={isBusy}
              >
                Clear all
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {staged.map((item, index) => (
                <li
                  key={item.id}
                  className="group relative overflow-hidden rounded-lg border border-line bg-paper shadow-paper"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.previewUrl}
                    alt={`Page ${index + 1}`}
                    className="aspect-[3/4] w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                    <span className="text-xs font-medium text-white">
                      Page {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeStaged(item.id)}
                      disabled={isBusy}
                      className="cursor-pointer rounded-full bg-paper/90 p-1 text-ink transition-colors duration-150 hover:bg-paper"
                      aria-label={`Remove page ${index + 1}`}
                    >
                      <IconX className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
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
          disabled={submitDisabled}
          className={btnPrimary}
        >
          {isBusy ? "Reading handwriting…" : "Continue to review"}
        </button>
      </div>
    </div>
  );
}
