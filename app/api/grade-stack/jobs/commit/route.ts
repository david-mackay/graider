import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { assertCanStartStackGrade, SubscriptionLimitError } from "@/lib/subscriptions/limits";
import { db } from "@/lib/db";
import { tests } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { OcrAnswer, StackAssignment } from "@/lib/types";
import {
  createGradeStackJob,
  findJobById,
  findJobByIdempotencyKey,
  setBullmqJobId,
} from "@/lib/grade-stack-jobs/repository";
import { enqueueStackCommitJob } from "@/lib/grade-stack-jobs/queue";
import { mapGradeStackJobRow } from "@/lib/grade-stack-jobs/map-job";

export const runtime = "nodejs";

function isOcrAnswer(value: unknown): value is OcrAnswer {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.question === "string" && typeof record.answer === "string";
}

function parseAssignments(raw: unknown): StackAssignment[] | null {
  if (!Array.isArray(raw)) return null;
  const assignments: StackAssignment[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;
    const record = entry as Record<string, unknown>;
    const pageIndexRaw = record.pageIndex;
    const studentIdRaw = record.studentId;
    const ocrAnswersRaw = record.ocrAnswers;

    if (typeof pageIndexRaw !== "number" || !Number.isFinite(pageIndexRaw)) return null;
    if (typeof studentIdRaw !== "string" || !studentIdRaw.trim()) return null;
    if (!Array.isArray(ocrAnswersRaw)) return null;
    if (!ocrAnswersRaw.every(isOcrAnswer)) return null;

    assignments.push({
      pageIndex: pageIndexRaw,
      studentId: studentIdRaw.trim(),
      ocrAnswers: ocrAnswersRaw.map((answer) => ({
        question: answer.question,
        answer: answer.answer,
        question_index:
          typeof answer.question_index === "number" ? answer.question_index : null,
      })),
      storagePath:
        typeof record.storagePath === "string"
          ? record.storagePath
          : record.storagePath === null
            ? null
            : undefined,
    });
  }

  return assignments;
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await requireRole("teacher");
    await assertCanStartStackGrade(teacher.id);
    const body = (await request.json()) as Record<string, unknown>;
    const testId = typeof body.testId === "string" ? body.testId.trim() : "";
    const previewJobId =
      typeof body.previewJobId === "string" ? body.previewJobId.trim() : null;
    const idempotencyKey =
      typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : null;
    const assignments = parseAssignments(body.assignments);

    if (!testId) {
      return NextResponse.json({ error: "testId is required." }, { status: 400 });
    }
    if (!assignments) {
      return NextResponse.json({ error: "Invalid assignments payload." }, { status: 400 });
    }
    if (assignments.length === 0) {
      return NextResponse.json(
        { error: "At least one assignment is required." },
        { status: 400 },
      );
    }

    if (idempotencyKey) {
      const existing = await findJobByIdempotencyKey(idempotencyKey);
      if (existing && existing.status !== "failed" && existing.status !== "cancelled") {
        const mapped = mapGradeStackJobRow(existing);
        return NextResponse.json(
          { jobId: mapped.id, phase: mapped.phase, status: mapped.status },
          { status: 202 },
        );
      }
    }

    if (previewJobId) {
      const previewJob = await findJobById(previewJobId);
      if (!previewJob) {
        return NextResponse.json({ error: "Preview job not found." }, { status: 404 });
      }
      if (previewJob.phase !== "preview") {
        return NextResponse.json({ error: "Invalid preview job." }, { status: 400 });
      }
      if (previewJob.status !== "needs_review" && previewJob.status !== "completed") {
        return NextResponse.json(
          { error: "Preview job is not ready for commit." },
          { status: 409 },
        );
      }
    }

    const [test] = await db
      .select({ id: tests.id, classId: tests.classId })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1);

    if (!test) {
      return NextResponse.json({ error: "Test not found." }, { status: 404 });
    }

    await requireClassAccess(test.classId, ["teacher"]);

    const job = await createGradeStackJob({
      phase: "commit",
      testId,
      classId: test.classId,
      teacherId: teacher.id,
      previewJobId,
      idempotencyKey,
      inputPayload: { assignments, previewJobId },
    });

    const bullmqJobId = await enqueueStackCommitJob(job.id);
    await setBullmqJobId(job.id, bullmqJobId);

    return NextResponse.json(
      { jobId: job.id, phase: "commit", status: "queued" },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof SubscriptionLimitError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 402 },
      );
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
