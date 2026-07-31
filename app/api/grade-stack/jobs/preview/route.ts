import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { objectExists, uploadFile } from "@/lib/storage";
import { assertCanStartStackGrade, SubscriptionLimitError } from "@/lib/subscriptions/limits";
import { db } from "@/lib/db";
import { tests } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { createDraftTestForAutoDiscovery } from "@/lib/stack-test-discovery";
import {
  clearIdempotencyKey,
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

function parseStudentPageAssignments(raw: unknown): StudentPageAssignment[] | undefined {
  if (typeof raw === "string") {
    if (!raw.trim()) return undefined;
    try {
      return parseStudentPageAssignments(JSON.parse(raw) as unknown);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(raw)) return undefined;
  const assignments: StudentPageAssignment[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return undefined;
    const record = entry as Record<string, unknown>;
    if (typeof record.pageIndex !== "number" || !Number.isFinite(record.pageIndex)) return undefined;
    if (typeof record.studentId !== "string" || !record.studentId.trim()) return undefined;
    assignments.push({ pageIndex: record.pageIndex, studentId: record.studentId.trim() });
  }
  return assignments.length > 0 ? assignments : undefined;
}

function normalizeImageName(fileName: string | undefined) {
  if (!fileName) return `upload-${Date.now()}`;
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 80);
}

function isStackPreviewPath(path: string, testId: string): boolean {
  const normalized = path.replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return false;
  return normalized.startsWith(`stack-preview/${testId}/`);
}

type JsonPreviewBody = {
  testId?: string;
  classId?: string | null;
  mode?: string;
  gradingMode?: string;
  idempotencyKey?: string | null;
  parsePreset?: string;
  studentPageAssignments?: unknown;
  storagePaths?: unknown;
  imageMeta?: unknown;
};

async function resolveIdempotency(idempotencyKey: string | null) {
  if (!idempotencyKey) return null;
  const existing = await findJobByIdempotencyKey(idempotencyKey);
  if (!existing) return null;
  if (existing.status !== "failed" && existing.status !== "cancelled") {
    return mapGradeStackJobRow(existing);
  }
  await clearIdempotencyKey(existing.id);
  return null;
}

async function resolveTestContext(params: {
  teacherId: string;
  testIdRaw: string;
  classIdRaw: string | null;
  autoDiscover: boolean;
}) {
  const { teacherId, testIdRaw, classIdRaw, autoDiscover } = params;
  if (autoDiscover && classIdRaw) {
    await requireClassAccess(classIdRaw, ["teacher"]);
    const testId = await createDraftTestForAutoDiscovery({
      classId: classIdRaw,
      teacherId,
    });
    return { testId, classId: classIdRaw };
  }

  const [test] = await db
    .select({ id: tests.id, classId: tests.classId })
    .from(tests)
    .where(eq(tests.id, testIdRaw))
    .limit(1);

  if (!test) {
    throw new Error("TEST_NOT_FOUND");
  }

  await requireClassAccess(test.classId, ["teacher"]);
  return { testId: test.id, classId: classIdRaw ?? test.classId };
}

async function enqueuePreviewJob(params: {
  testId: string;
  classId: string | null;
  teacherId: string;
  idempotencyKey: string | null;
  storagePaths: string[];
  imageMeta: { filename: string; mimeType: string }[];
  autoDiscover: boolean;
  studentPageAssignments?: StudentPageAssignment[];
  gradingMode: "student_first" | "stack";
  parsePreset: string;
}) {
  const job = await createGradeStackJob({
    phase: "preview",
    testId: params.testId,
    classId: params.classId,
    teacherId: params.teacherId,
    idempotencyKey: params.idempotencyKey,
    inputPayload: {
      storagePaths: params.storagePaths,
      imageMeta: params.imageMeta,
      autoDiscover: params.autoDiscover,
      classId: params.classId,
      studentPageAssignments: params.studentPageAssignments,
      gradingMode: params.gradingMode,
      parsePreset: params.parsePreset,
    },
  });

  const bullmqJobId = await enqueueStackPreviewJob(job.id);
  await setBullmqJobId(job.id, bullmqJobId);
  return job;
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await requireRole("teacher");
    await assertCanStartStackGrade(teacher.id);

    const contentType = request.headers.get("content-type") ?? "";

    // Path-only JSON body: client already uploaded via signed URLs.
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as JsonPreviewBody;
      const mode = body.mode?.trim() ?? "selected";
      const testIdRaw = body.testId?.trim() ?? "";
      const classIdRaw = body.classId?.trim() ?? null;
      const idempotencyKey = body.idempotencyKey?.trim() || null;
      const autoDiscover = mode === "auto";
      const studentPageAssignments = parseStudentPageAssignments(body.studentPageAssignments);
      const gradingMode =
        body.gradingMode === "student_first" || studentPageAssignments?.length
          ? "student_first"
          : "stack";

      if (!autoDiscover && !testIdRaw) {
        return NextResponse.json({ error: "testId is required." }, { status: 400 });
      }
      if (autoDiscover && !classIdRaw) {
        return NextResponse.json({ error: "classId is required for smart grading." }, { status: 400 });
      }

      const existing = await resolveIdempotency(idempotencyKey);
      if (existing) {
        return NextResponse.json(
          { jobId: existing.id, phase: existing.phase, status: existing.status },
          { status: 202 },
        );
      }

      let testId: string;
      let classId: string | null;
      try {
        const resolved = await resolveTestContext({
          teacherId: teacher.id,
          testIdRaw,
          classIdRaw,
          autoDiscover,
        });
        testId = resolved.testId;
        classId = resolved.classId;
      } catch (error) {
        if (error instanceof Error && error.message === "TEST_NOT_FOUND") {
          return NextResponse.json({ error: "Test not found." }, { status: 404 });
        }
        throw error;
      }

      const rawPaths = Array.isArray(body.storagePaths) ? body.storagePaths : [];
      const storagePaths = rawPaths.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
      if (storagePaths.length === 0) {
        return NextResponse.json({ error: "storagePaths are required." }, { status: 400 });
      }
      if (storagePaths.length > MAX_IMAGES_PER_REQUEST) {
        return NextResponse.json(
          { error: `Too many images. Max ${MAX_IMAGES_PER_REQUEST} per request.` },
          { status: 400 },
        );
      }

      for (const storagePath of storagePaths) {
        if (!isStackPreviewPath(storagePath, testId)) {
          return NextResponse.json({ error: "Invalid storage path." }, { status: 400 });
        }
        const exists = await objectExists(storagePath);
        if (!exists) {
          return NextResponse.json(
            { error: `Upload missing in storage: ${storagePath}` },
            { status: 400 },
          );
        }
      }

      const rawMeta = Array.isArray(body.imageMeta) ? body.imageMeta : [];
      const imageMeta = storagePaths.map((storagePath, index) => {
        const entry = rawMeta[index] as { filename?: unknown; mimeType?: unknown } | undefined;
        return {
          filename:
            typeof entry?.filename === "string" && entry.filename.trim()
              ? entry.filename.trim()
              : storagePath.split("/").pop() ?? `page-${index}`,
          mimeType:
            typeof entry?.mimeType === "string" && entry.mimeType.trim()
              ? entry.mimeType.trim()
              : "image/jpeg",
        };
      });

      const job = await enqueuePreviewJob({
        testId,
        classId,
        teacherId: teacher.id,
        idempotencyKey,
        storagePaths,
        imageMeta,
        autoDiscover,
        studentPageAssignments,
        gradingMode,
        parsePreset: coerceParsePreset(body.parsePreset, "grade_stack"),
      });

      return NextResponse.json(
        { jobId: job.id, phase: "preview", status: "queued" },
        { status: 202 },
      );
    }

    // Legacy multipart: server proxies bytes to storage (fallback / older clients).
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

    const existing = await resolveIdempotency(idempotencyKey);
    if (existing) {
      return NextResponse.json(
        { jobId: existing.id, phase: existing.phase, status: existing.status },
        { status: 202 },
      );
    }

    let testId: string;
    let classId: string | null;
    try {
      const resolved = await resolveTestContext({
        teacherId: teacher.id,
        testIdRaw,
        classIdRaw,
        autoDiscover,
      });
      testId = resolved.testId;
      classId = resolved.classId;
    } catch (error) {
      if (error instanceof Error && error.message === "TEST_NOT_FOUND") {
        return NextResponse.json({ error: "Test not found." }, { status: 404 });
      }
      throw error;
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

    const job = await enqueuePreviewJob({
      testId,
      classId,
      teacherId: teacher.id,
      idempotencyKey,
      storagePaths,
      imageMeta,
      autoDiscover,
      studentPageAssignments,
      gradingMode,
      parsePreset: coerceParsePreset(form.get("parsePreset")?.toString(), "grade_stack"),
    });

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
