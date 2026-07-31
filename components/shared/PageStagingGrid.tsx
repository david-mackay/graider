"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { IconX } from "@/components/shared/icons";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];
const ACCEPTED_EXT = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;
const DEFAULT_MAX = 10;

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  return ACCEPTED_EXT.test(file.name);
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export type StagedPage = {
  id: string;
  file: File;
  previewUrl: string;
};

type PageStagingGridProps = {
  onFilesChange: (files: File[]) => void;
  maxPages?: number;
  disabled?: boolean;
  dropLabel?: string;
  onError?: (message: string) => void;
  /** Seed the grid on mount (e.g. when editing an existing student). */
  initialFiles?: File[];
};

export function makeId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function PageStagingGrid({
  onFilesChange,
  maxPages = DEFAULT_MAX,
  disabled = false,
  dropLabel = "Drop photos here, or click to choose",
  onError,
  initialFiles,
}: PageStagingGridProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<StagedPage[]>(() => {
    if (!initialFiles?.length) return [];
    return initialFiles.map((file) => ({
      id: makeId(file),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
  });
  const [dropActive, setDropActive] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current || !initialFiles?.length) return;
    seededRef.current = true;
    onFilesChange(initialFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      for (const s of staged) URL.revokeObjectURL(s.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLightboxIndex(null);
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((i) => (i !== null ? Math.min(i + 1, staged.length - 1) : i));
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lightboxIndex, staged.length]);

  function addFiles(incoming: File[]) {
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of incoming) {
      if (!isAcceptedFile(f)) {
        rejected.push(f.name);
      } else {
        accepted.push(f);
      }
    }
    if (rejected.length > 0) {
      onError?.(`These files aren't JPG, PNG, or PDF: ${rejected.join(", ")}`);
    }
    setStaged((prev) => {
      const remaining = maxPages - prev.length;
      if (remaining <= 0) {
        onError?.(`Maximum ${maxPages} pages.`);
        return prev;
      }
      const toAdd = accepted.slice(0, remaining);
      if (accepted.length > toAdd.length) {
        onError?.(`Only the first ${maxPages} pages were added.`);
      }
      const next: StagedPage[] = [
        ...prev,
        ...toAdd.map((file) => ({
          id: makeId(file),
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ];
      onFilesChange(next.map((s) => s.file));
      return next;
    });
  }

  function removePage(id: string) {
    setStaged((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((s) => s.id !== id);
      onFilesChange(next.map((s) => s.file));
      return next;
    });
    setLightboxIndex((i) => {
      if (i === null) return null;
      return i > 0 ? i - 1 : staged.length > 1 ? 0 : null;
    });
  }

  function clearAll() {
    for (const s of staged) URL.revokeObjectURL(s.previewUrl);
    setStaged([]);
    onFilesChange([]);
    setLightboxIndex(null);
  }

  function handleZoneDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDropActive(false);
    if (disabled) return;
    addFiles(Array.from(e.dataTransfer.files));
  }

  function reorder(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    setStaged((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      onFilesChange(next.map((s) => s.file));
      return next;
    });
    if (lightboxIndex === fromIdx) setLightboxIndex(toIdx);
    else if (lightboxIndex !== null && fromIdx < toIdx && lightboxIndex > fromIdx && lightboxIndex <= toIdx) {
      setLightboxIndex((i) => (i !== null ? i - 1 : null));
    } else if (lightboxIndex !== null && fromIdx > toIdx && lightboxIndex >= toIdx && lightboxIndex < fromIdx) {
      setLightboxIndex((i) => (i !== null ? i + 1 : null));
    }
  }

  return (
    <>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={handleZoneDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={[
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150",
          dropActive ? "border-pen bg-pen-wash" : "border-line bg-cream/60 hover:border-ink-faint hover:bg-cream",
          disabled ? "cursor-not-allowed opacity-50" : "",
        ].join(" ")}
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
        <p className="text-sm font-bold text-ink">{dropLabel}</p>
        <p className="mt-1 text-xs text-ink-soft">
          JPG, PNG, or PDF · up to {maxPages} file{maxPages !== 1 ? "s" : ""}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {/* Staged grid */}
      {staged.length > 0 ? (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-faint">
              Pages ready ({staged.length})
            </p>
            <button
              type="button"
              onClick={clearAll}
              disabled={disabled}
              className="cursor-pointer text-xs font-bold text-ink-soft transition-colors duration-150 hover:text-pen"
            >
              Clear all
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {staged.map((item, index) => (
              <li
                key={item.id}
                draggable={!disabled}
                onDragStart={() => setDragFromIndex(index)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIndex(index);
                }}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragFromIndex !== null) reorder(dragFromIndex, index);
                  setDragFromIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragFromIndex(null);
                  setDragOverIndex(null);
                }}
                className={[
                  "group relative cursor-grab overflow-hidden rounded-lg border bg-paper shadow-paper active:cursor-grabbing",
                  dragOverIndex === index && dragFromIndex !== index
                    ? "border-pen ring-2 ring-pen/30"
                    : "border-line",
                ].join(" ")}
              >
                {isPdfFile(item.file) ? (
                  <div
                    onClick={() => setLightboxIndex(index)}
                    className="flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center gap-2 bg-cream px-3 text-center"
                  >
                    <span className="rounded-md bg-pen px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      PDF
                    </span>
                    <p className="line-clamp-3 text-xs font-medium text-ink-soft">{item.file.name}</p>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={`Page ${index + 1}`}
                    draggable={false}
                    onClick={() => setLightboxIndex(index)}
                    className="aspect-[3/4] w-full cursor-pointer object-cover"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                  <span className="text-xs font-medium text-white">p{index + 1}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePage(item.id);
                    }}
                    disabled={disabled}
                    className="cursor-pointer rounded-full bg-paper/90 p-1 text-ink transition-colors duration-150 hover:bg-paper"
                    aria-label={`Remove page ${index + 1}`}
                  >
                    <IconX className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-faint">Drag to reorder · click to preview</p>
        </div>
      ) : null}

      {/* Lightbox */}
      {lightboxIndex !== null && staged[lightboxIndex] ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative mx-4 flex max-h-[90vh] max-w-2xl flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {isPdfFile(staged[lightboxIndex].file) ? (
              <iframe
                title={`PDF ${lightboxIndex + 1}`}
                src={staged[lightboxIndex].previewUrl}
                className="h-[80vh] w-full min-w-[min(90vw,40rem)] rounded-xl bg-paper shadow-paper"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={staged[lightboxIndex].previewUrl}
                alt={`Page ${lightboxIndex + 1}`}
                className="max-h-[80vh] w-full rounded-xl object-contain shadow-paper"
                draggable={false}
              />
            )}
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                disabled={lightboxIndex === 0}
                className="rounded-full border border-line/60 bg-paper px-4 py-1.5 text-sm font-bold text-ink shadow-paper transition-colors hover:bg-cream disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="text-sm font-medium text-white">
                {lightboxIndex + 1} / {staged.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((i) =>
                    i !== null ? Math.min(i + 1, staged.length - 1) : i,
                  )
                }
                disabled={lightboxIndex === staged.length - 1}
                className="rounded-full border border-line/60 bg-paper px-4 py-1.5 text-sm font-bold text-ink shadow-paper transition-colors hover:bg-cream disabled:opacity-30"
              >
                Next →
              </button>
            </div>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="absolute -right-3 -top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-paper shadow-paper hover:bg-cream"
              aria-label="Close preview"
            >
              <IconX className="h-4 w-4 text-ink" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
