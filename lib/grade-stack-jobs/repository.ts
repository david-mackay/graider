import { db } from "@/lib/db";
import { gradeStackJobs } from "@/drizzle/schema";
import {
  GradeStackCommitJobInput,
  GradeStackCommitPayload,
  GradeStackJobFailure,
  GradeStackJobPhase,
  GradeStackJobStatus,
  GradeStackPreviewJobInput,
  GradeStackPreviewPayload,
} from "@/lib/types";
import { eq } from "drizzle-orm";

type CreateJobParams = {
  phase: GradeStackJobPhase;
  testId: string;
  classId: string | null;
  teacherId: string;
  idempotencyKey?: string | null;
  previewJobId?: string | null;
  inputPayload: GradeStackPreviewJobInput | GradeStackCommitJobInput;
};

export async function findJobByIdempotencyKey(idempotencyKey: string) {
  const [row] = await db
    .select()
    .from(gradeStackJobs)
    .where(eq(gradeStackJobs.idempotencyKey, idempotencyKey))
    .limit(1);
  return row ?? null;
}

export async function findJobById(jobId: string) {
  const [row] = await db
    .select()
    .from(gradeStackJobs)
    .where(eq(gradeStackJobs.id, jobId))
    .limit(1);
  return row ?? null;
}

export async function createGradeStackJob(params: CreateJobParams) {
  const [row] = await db
    .insert(gradeStackJobs)
    .values({
      phase: params.phase,
      status: "queued",
      testId: params.testId,
      classId: params.classId,
      teacherId: params.teacherId,
      previewJobId: params.previewJobId ?? null,
      idempotencyKey: params.idempotencyKey ?? null,
      inputPayload: params.inputPayload,
    })
    .returning();
  if (!row) {
    throw new Error("Failed to start grading.");
  }
  return row;
}

export async function setBullmqJobId(jobId: string, bullmqJobId: string) {
  await db
    .update(gradeStackJobs)
    .set({ bullmqJobId, updatedAt: new Date() })
    .where(eq(gradeStackJobs.id, jobId));
}

export async function updateJobStatus(
  jobId: string,
  status: GradeStackJobStatus,
  patch?: {
    error?: string | null;
    attemptCount?: number;
  },
) {
  await db
    .update(gradeStackJobs)
    .set({
      status,
      error: patch?.error ?? undefined,
      attemptCount: patch?.attemptCount ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(gradeStackJobs.id, jobId));
}

export async function completePreviewJob(
  jobId: string,
  preview: GradeStackPreviewPayload,
  options?: { testId?: string },
) {
  await db
    .update(gradeStackJobs)
    .set({
      status: "needs_review",
      previewPayload: preview,
      ...(options?.testId ? { testId: options.testId } : {}),
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(gradeStackJobs.id, jobId));
}

export async function updateCommitProgress(jobId: string, commit: GradeStackCommitPayload) {
  await db
    .update(gradeStackJobs)
    .set({
      status: "processing",
      commitPayload: commit,
      updatedAt: new Date(),
    })
    .where(eq(gradeStackJobs.id, jobId));
}

export async function completeCommitJob(jobId: string, commit: GradeStackCommitPayload) {
  await db
    .update(gradeStackJobs)
    .set({
      status: "completed",
      commitPayload: commit,
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(gradeStackJobs.id, jobId));
}

export async function failJob(
  jobId: string,
  error: string,
  failures: GradeStackJobFailure[] = [],
) {
  await db
    .update(gradeStackJobs)
    .set({
      status: "failed",
      error,
      failures,
      updatedAt: new Date(),
    })
    .where(eq(gradeStackJobs.id, jobId));
}

/** Free the unique key so a retry can create a fresh job. */
export async function clearIdempotencyKey(jobId: string) {
  await db
    .update(gradeStackJobs)
    .set({ idempotencyKey: null, updatedAt: new Date() })
    .where(eq(gradeStackJobs.id, jobId));
}

export async function cancelJob(jobId: string, reason = "Cancelled by teacher.") {
  await db
    .update(gradeStackJobs)
    .set({
      status: "cancelled",
      error: reason,
      updatedAt: new Date(),
    })
    .where(eq(gradeStackJobs.id, jobId));
}

export async function incrementAttemptCount(jobId: string) {
  const row = await findJobById(jobId);
  if (!row) return;
  await db
    .update(gradeStackJobs)
    .set({
      attemptCount: row.attemptCount + 1,
      updatedAt: new Date(),
    })
    .where(eq(gradeStackJobs.id, jobId));
}
