import { db } from "@/lib/db";
import { contentImportJobs } from "@/drizzle/schema";
import type { ContentImportJobKind, ContentImportJobStatus, ContentImportResult } from "@/lib/types";
import { eq } from "drizzle-orm";

export async function createContentImportJob(params: {
  kind: ContentImportJobKind;
  classId: string;
  teacherId: string;
  storagePath: string;
  extraStoragePaths?: string[];
  targetTestId?: string | null;
  parsePreset?: string | null;
}) {
  const [row] = await db
    .insert(contentImportJobs)
    .values({
      kind: params.kind,
      status: "queued",
      classId: params.classId,
      teacherId: params.teacherId,
      storagePath: params.storagePath,
      extraStoragePaths: params.extraStoragePaths ?? [],
      targetTestId: params.targetTestId ?? null,
      parsePreset: params.parsePreset ?? null,
    })
    .returning();
  if (!row) throw new Error("Failed to create import job.");
  return row;
}

export async function findContentImportJob(jobId: string) {
  const [row] = await db
    .select()
    .from(contentImportJobs)
    .where(eq(contentImportJobs.id, jobId))
    .limit(1);
  return row ?? null;
}

export async function setContentImportBullmqJobId(jobId: string, bullmqJobId: string) {
  await db
    .update(contentImportJobs)
    .set({ bullmqJobId, updatedAt: new Date() })
    .where(eq(contentImportJobs.id, jobId));
}

export async function updateContentImportStatus(
  jobId: string,
  status: ContentImportJobStatus,
  patch?: { error?: string | null },
) {
  await db
    .update(contentImportJobs)
    .set({
      status,
      error: patch?.error ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(contentImportJobs.id, jobId));
}

export async function completeContentImportJob(jobId: string, result: ContentImportResult) {
  await db
    .update(contentImportJobs)
    .set({
      status: "completed",
      resultPayload: result,
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(contentImportJobs.id, jobId));
}

export async function failContentImportJob(jobId: string, message: string) {
  await db
    .update(contentImportJobs)
    .set({
      status: "failed",
      error: message,
      updatedAt: new Date(),
    })
    .where(eq(contentImportJobs.id, jobId));
}
