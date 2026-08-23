import type { StackPagePreview } from "@/lib/types";
import { defaultPresetForSurface, type DocumentParsePreset } from "@/lib/parse-presets";

export const MAX_PAGES_PER_STUDENT = 15;
export const MAX_STUDENTS_PER_SESSION = 10;
export const MAX_TOTAL_PAGES = 30;

export type StudentSendStatus = "idle" | "sending" | "ready" | "error";

export type StudentBucket = {
  studentId: string;
  studentName: string;
  pages: File[];
  sendStatus: StudentSendStatus;
  sendError: string | null;
  previewJobId: string | null;
  /** Preview pages for this student only (local pageIndex 0..n-1 from the job). */
  previewPages: StackPagePreview[];
  /** How this student's pages should be parsed. Independent of other students. */
  parsePreset: DocumentParsePreset;
};

export function createEmptyBucket(studentId: string, studentName: string): StudentBucket {
  return {
    studentId,
    studentName,
    pages: [],
    sendStatus: "idle",
    sendError: null,
    previewJobId: null,
    previewPages: [],
    parsePreset: defaultPresetForSurface("grade_stack"),
  };
}

export type FlattenedSession = {
  files: File[];
  /** Global page index → student assignment */
  pageToStudentId: Map<number, string>;
  /** studentId → ordered global page indices */
  studentPageIndices: Map<string, number[]>;
};

export function flattenStudentBuckets(buckets: StudentBucket[]): FlattenedSession {
  const files: File[] = [];
  const pageToStudentId = new Map<number, string>();
  const studentPageIndices = new Map<string, number[]>();

  for (const bucket of buckets) {
    const indices: number[] = [];
    for (const page of bucket.pages) {
      const globalIndex = files.length;
      files.push(page);
      pageToStudentId.set(globalIndex, bucket.studentId);
      indices.push(globalIndex);
    }
    if (indices.length > 0) {
      studentPageIndices.set(bucket.studentId, indices);
    }
  }

  return { files, pageToStudentId, studentPageIndices };
}

/** Merge per-student preview slices into one session-wide preview + image file list. */
export function mergeReadyStudentPreviews(buckets: StudentBucket[]): {
  pages: StackPagePreview[];
  pageToStudentId: Map<number, string>;
  imageFiles: File[];
  /** Prefer the most recent ready job id for commit linkage. */
  previewJobId: string | null;
} {
  const pages: StackPagePreview[] = [];
  const pageToStudentId = new Map<number, string>();
  const imageFiles: File[] = [];
  let previewJobId: string | null = null;

  for (const bucket of buckets) {
    if (bucket.sendStatus !== "ready" || bucket.previewPages.length === 0) continue;
    previewJobId = bucket.previewJobId ?? previewJobId;
    const sorted = [...bucket.previewPages].sort((a, b) => a.pageIndex - b.pageIndex);
    for (let i = 0; i < sorted.length; i += 1) {
      const local = sorted[i];
      const globalIndex = pages.length;
      pages.push({ ...local, pageIndex: globalIndex });
      pageToStudentId.set(globalIndex, bucket.studentId);
      imageFiles.push(bucket.pages[i] ?? bucket.pages[bucket.pages.length - 1]!);
    }
  }

  return { pages, pageToStudentId, imageFiles, previewJobId };
}

export function movePageInBucket(pages: File[], fromIndex: number, toIndex: number): File[] {
  if (fromIndex === toIndex) return pages;
  if (fromIndex < 0 || fromIndex >= pages.length) return pages;
  if (toIndex < 0 || toIndex >= pages.length) return pages;
  const next = [...pages];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function totalPageCount(buckets: StudentBucket[]): number {
  return buckets.reduce((sum, bucket) => sum + bucket.pages.length, 0);
}

export function studentDisplayName(
  studentId: string,
  rosterName: string | null | undefined,
  fallback?: string,
): string {
  if (rosterName && rosterName.trim()) return rosterName.trim();
  return fallback ?? studentId.slice(0, 8);
}

/** Stable-ish key for a File without needing extra metadata. */
export function fileKey(file: File, index: number): string {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

export function pagesFingerprint(pages: File[]): string {
  return pages.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join("|");
}
