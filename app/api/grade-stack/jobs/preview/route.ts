import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import { assertCanStartStackGrade, SubscriptionLimitError } from "@/lib/subscriptions/limits";
import { db } from "@/lib/db";
import { tests } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { createDraftTestForAutoDiscovery } from "@/lib/stack-test-discovery";
import {
  createGradeStackJob,
  findJobByIdempotencyKey,
  setBullmqJobId,
} from "@/lib/grade-stack-jobs/repository";
import { enqueueStackPreviewJob } from "@/lib/grade-stack-jobs/queue";
import { mapGradeStackJobRow } from "@/lib/grade-stack-jobs/map-job";
import { coerceParsePreset } from "@/lib/parse-presets";
import type { StudentPageAssignment } from "@/lib/types";

export const runtime = "nodejs";

/** Student-first mobile sessions may include many pages across multiple students. */
const MAX_IMAGES_PER_REQUEST = 30;

function isFileLike(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function parseStudentPageAssignments(raw: string | null): StudentPageAssignment[] | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const assignments: StudentPageAssignment[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) return undefined;
      const record = entry as Record<string, unknown>;
      if (typeof record.pageIndex !== "number" || !Number.isFinite(record.pageIndex)) return undefined;
      if (typeof record.studentId !== "string" || !record.studentId.trim()) return undefined;
      assignments.push({ pageIndex: record.pageIndex, studentId: record.studentId.trim() });
    }
    return assignments.length > 0 ? assignments : undefined;
  } catch {
    return undefined;
  }
}

function normalizeImageName(fileName: string | undefined) {
  if (!fileName) return `upload-${Date.now()}`;
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 80);
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await requireRole("teacher");
    await assertCanStartStackGrade(teacher.id);
    const form = await request.formData();
    const mode = form.get("mode")?.toString().trim() ?? "selected";
    const testIdRaw = form.get("testId")?.toString().trim() ?? "";
    const classIdRaw = form.get("classId")?.toString().trim() ?? null;
    const idempotencyKey = form.get("idempotencyKey")?.toString().trim() || null;
    const autoDiscover = mode === "auto";
    const gradingModeRaw = form.get("gradingMode")?.toString().trim();
    const studentPageAssignments = parseStudentPageAssignments(
      form.get("studentPageAssignments")?.toString() ?? null,
    );
    const gradingMode =
      gradingModeRaw === "student_first" || studentPageAssignments?.length
        ? "student_first"
        : "stack";

    if (!autoDiscover && !testIdRaw) {
      return NextResponse.json({ error: "testId is required." }, { status: 400 });
    }
    if (autoDiscover && !classIdRaw) {
      return NextResponse.json({ error: "classId is required for smart grading." }, { status: 400 });
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

    let testId = testIdRaw;
    let classId = classIdRaw;

    if (autoDiscover && classIdRaw) {
      await requireClassAccess(classIdRaw, ["teacher"]);
      testId = await createDraftTestForAutoDiscovery({
        classId: classIdRaw,
        teacherId: teacher.id,
      });
      classId = classIdRaw;
    } else {
      const [test] = await db
        .select({ id: tests.id, classId: tests.classId })
        .from(tests)
        .where(eq(tests.id, testId))
        .limit(1);

      if (!test) {
        return NextResponse.json({ error: "Test not found." }, { status: 404 });
      }

      await requireClassAccess(test.classId, ["teacher"]);
      classId = classId ?? test.classId;
    }

    const files = form.getAll("images");
    const fileLike = files.filter(isFileLike);

    if (fileLike.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required." },
        { status: 400 },
      );
    }
    if (fileLike.length > MAX_IMAGES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Too many images. Max ${MAX_IMAGES_PER_REQUEST} per request.` },
        { status: 400 },
      );
    }

    const storagePaths: string[] = [];
    const imageMeta: { filename: string; mimeType: string }[] = [];
    const requestStamp = Date.now();

    for (let index = 0; index < fileLike.length; index += 1) {
      const fileInput = fileLike[index];
      const buffer = Buffer.from(await fileInput.arrayBuffer());
      const extensionMatch = fileInput.name?.match(/(\.[a-zA-Z0-9]+)$/);
      const baseName = `${requestStamp}-${index}-${normalizeImageName(fileInput.name)}`;
      const uploadPath = `stack-preview/${testId}/${baseName}${extensionMatch ? "" : ".png"}`;

      await uploadFile(uploadPath, buffer, fileInput.type || "image/png");
      storagePaths.push(uploadPath);
      imageMeta.push({
        filename: fileInput.name ?? `page-${index}`,
        mimeType: fileInput.type || "image/png",
      });
    }

    const parsePreset = coerceParsePreset(
      form.get("parsePreset")?.toString(),
      "grade_stack",
    );

    const job = await createGradeStackJob({
      phase: "preview",
      testId,
      classId: classId ?? null,
      teacherId: teacher.id,
      idempotencyKey,
      inputPayload: {
        storagePaths,
        imageMeta,
        autoDiscover,
        classId,
        studentPageAssignments,
        gradingMode,
        parsePreset,
      },
    });

    const bullmqJobId = await enqueueStackPreviewJob(job.id);
    await setBullmqJobId(job.id, bullmqJobId);

    return NextResponse.json(
      { jobId: job.id, phase: "preview", status: "queued" },
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
