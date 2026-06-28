import { gradeStackJobs } from "@/drizzle/schema";
import {
  GradeStackCommitJobInput,
  GradeStackCommitPayload,
  GradeStackJob,
  GradeStackJobFailure,
  GradeStackJobPhase,
  GradeStackJobStatus,
  GradeStackPreviewJobInput,
  GradeStackPreviewPayload,
} from "@/lib/types";

type GradeStackJobRow = typeof gradeStackJobs.$inferSelect;

function asPhase(value: string): GradeStackJobPhase {
  return value === "commit" ? "commit" : "preview";
}

function asStatus(value: string): GradeStackJobStatus {
  const allowed: GradeStackJobStatus[] = [
    "queued",
    "processing",
    "needs_review",
    "completed",
    "failed",
    "cancelled",
  ];
  return allowed.includes(value as GradeStackJobStatus)
    ? (value as GradeStackJobStatus)
    : "failed";
}

function asFailures(value: unknown): GradeStackJobFailure[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is GradeStackJobFailure =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as GradeStackJobFailure).code === "string" &&
      typeof (entry as GradeStackJobFailure).message === "string",
  );
}

export function mapGradeStackJobRow(row: GradeStackJobRow): GradeStackJob {
  const preview = row.previewPayload as GradeStackPreviewPayload | null;
  const commit = row.commitPayload as GradeStackCommitPayload | null;

  return {
    id: row.id,
    phase: asPhase(row.phase),
    status: asStatus(row.status),
    testId: row.testId,
    classId: row.classId,
    attemptCount: row.attemptCount,
    idempotencyKey: row.idempotencyKey,
    preview: preview ?? null,
    commit: commit ?? null,
    failures: asFailures(row.failures),
    error: row.error,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

export function getPreviewInput(row: GradeStackJobRow): GradeStackPreviewJobInput {
  const input = row.inputPayload as GradeStackPreviewJobInput;
  return {
    storagePaths: Array.isArray(input?.storagePaths) ? input.storagePaths : [],
    imageMeta: Array.isArray(input?.imageMeta) ? input.imageMeta : [],
  };
}

export function getCommitInput(row: GradeStackJobRow): GradeStackCommitJobInput {
  const input = row.inputPayload as GradeStackCommitJobInput;
  return {
    assignments: Array.isArray(input?.assignments) ? input.assignments : [],
    previewJobId: typeof input?.previewJobId === "string" ? input.previewJobId : null,
  };
}
