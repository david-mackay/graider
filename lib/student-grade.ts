export const MAX_PAGES_PER_STUDENT = 15;
export const MAX_STUDENTS_PER_SESSION = 10;
export const MAX_TOTAL_PAGES = 30;

export type StudentBucket = {
  studentId: string;
  studentName: string;
  pages: File[];
};

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
