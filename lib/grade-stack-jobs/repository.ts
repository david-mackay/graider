import { db } from "@/lib/db";
import { gradeStackJobs, tests } from "@/drizzle/schema";
import {
  GradeStackCommitJobInput,
  GradeStackCommitPayload,
  GradeStackCommitProgress,
  GradeStackJobFailure,
  GradeStackJobPhase,
  GradeStackJobStatus,
  GradeStackPreviewJobInput,
  GradeStackPreviewPayload,
} from "@/lib/types";
import { and, desc, eq, inArray } from "drizzle-orm";

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

export async function updatePreviewProgress(jobId: string, progress: GradeStackCommitProgress) {
  const row = await findJobById(jobId);
  const existing = (row?.previewPayload as GradeStackPreviewPayload | null) ?? null;
  await db
    .update(gradeStackJobs)
    .set({
      status: "processing",
      previewPayload: {
        pages: existing?.pages ?? [],
        discovery: existing?.discovery,
        studentPageAssignments: existing?.studentPageAssignments,
        progress,
      },
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

export async function listResumablePreviewJobs(teacherId: string) {
  const previews = await db
    .select({
      id: gradeStackJobs.id,
      testId: gradeStackJobs.testId,
      testTitle: tests.title,
      previewPayload: gradeStackJobs.previewPayload,
      inputPayload: gradeStackJobs.inputPayload,
      updatedAt: gradeStackJobs.updatedAt,
    })
    .from(gradeStackJobs)
    .innerJoin(tests, eq(tests.id, gradeStackJobs.testId))
    .where(
      and(
        eq(gradeStackJobs.teacherId, teacherId),
        eq(gradeStackJobs.phase, "preview"),
        eq(gradeStackJobs.status, "needs_review"),
      ),
    )
    .orderBy(desc(gradeStackJobs.updatedAt))
    .limit(30);

  if (previews.length === 0) return [];

  const commits = await db
    .select({ previewJobId: gradeStackJobs.previewJobId })
    .from(gradeStackJobs)
    .where(
      and(
        eq(gradeStackJobs.teacherId, teacherId),
        eq(gradeStackJobs.phase, "commit"),
        inArray(gradeStackJobs.status, ["completed", "processing", "queued"]),
        inArray(
          gradeStackJobs.previewJobId,
          previews.map((row) => row.id),
        ),
      ),
    );
  const consumed = new Set(
    commits.map((row) => row.previewJobId).filter((id): id is string => typeof id === "string"),
  );

  return previews
    .filter((row) => !consumed.has(row.id))
    .map((row) => {
      const preview = row.previewPayload as GradeStackPreviewPayload | null;
      const input = row.inputPayload as GradeStackPreviewJobInput | null;
      const pages = preview?.pages ?? [];
      const assignments =
        preview?.studentPageAssignments ?? input?.studentPageAssignments ?? [];
      const studentIds = new Set(assignments.map((item) => item.studentId));
      return {
        id: row.id,
        testId: row.testId,
        testTitle: row.testTitle,
        pageCount: pages.length || assignments.length,
        studentCount: studentIds.size,
        updatedAt: row.updatedAt ?? new Date(),
      };
    });
}
