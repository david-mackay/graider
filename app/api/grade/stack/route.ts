import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import { db } from "@/lib/db";
import { tests } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { previewStack, commitStack } from "@/lib/stack-grading";
import { coerceParsePreset } from "@/lib/parse-presets";
import { OcrAnswer, StackAssignment } from "@/lib/types";
import { coercePrintedQuestionIndex } from "@/lib/question-index";

export const runtime = "nodejs";

const MAX_IMAGES_PER_REQUEST = 10;

function isFileLike(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function normalizeImageName(fileName: string | undefined) {
  if (!fileName) return `upload-${Date.now()}`;
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 80);
}

function isOcrAnswer(value: unknown): value is OcrAnswer {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.question === "string" && typeof record.answer === "string";
}

function parseAssignments(raw: string): StackAssignment[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const assignments: StackAssignment[] = [];
  for (const entry of parsed) {
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
        question_index: coercePrintedQuestionIndex(answer.question_index),
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
    const form = await request.formData();
    const testId = form.get("testId")?.toString().trim();

    if (!testId) {
      return NextResponse.json({ error: "testId is required." }, { status: 400 });
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

    const assignmentsRaw = form.get("assignments")?.toString();

    if (assignmentsRaw) {
      // Phase B: commit. The teacher has confirmed which student each page belongs to.
      const assignments = parseAssignments(assignmentsRaw);
      if (!assignments) {
        return NextResponse.json(
          { error: "Invalid assignments payload." },
          { status: 400 },
        );
      }
      if (assignments.length === 0) {
        return NextResponse.json(
          { error: "At least one assignment is required." },
          { status: 400 },
        );
      }

      try {
        const result = await commitStack({
          testId,
          pages: assignments,
          teacherId: teacher.id,
        });
        return NextResponse.json({ phase: "commit", results: result.results });
      } catch (innerError) {
        const innerMessage =
          innerError instanceof Error ? innerError.message : "Unexpected error";
        if (innerMessage.startsWith("INVALID_STUDENT_IDS:")) {
          const stale = innerMessage.slice("INVALID_STUDENT_IDS:".length);
          return NextResponse.json(
            {
              error: `One or more students are not active members of this class: ${stale}`,
            },
            { status: 400 },
          );
        }
        if (innerMessage === "TEST_NOT_FOUND") {
          return NextResponse.json({ error: "Test not found." }, { status: 404 });
        }
        throw innerError;
      }
    }

    // Phase A: preview. Parse images, upload them to storage, run OCR + roster matching.
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

    const imagePayloads: { filename: string; mimeType: string; base64: string }[] = [];
    const storagePaths: (string | null)[] = [];
    const requestStamp = Date.now();

    for (let index = 0; index < fileLike.length; index++) {
      const fileInput = fileLike[index];
      const buffer = Buffer.from(await fileInput.arrayBuffer());
      const extensionMatch = fileInput.name?.match(/(\.[a-zA-Z0-9]+)$/);
      const baseName = `${requestStamp}-${index}-${normalizeImageName(fileInput.name)}`;
      const uploadPath = `stack-preview/${testId}/${baseName}${extensionMatch ? "" : ".png"}`;

      await uploadFile(uploadPath, buffer, fileInput.type || "image/png");
      storagePaths.push(uploadPath);

      imagePayloads.push({
        filename: fileInput.name,
        mimeType: fileInput.type || "image/png",
        base64: buffer.toString("base64"),
      });
    }

    try {
      const preview = await previewStack({
        testId,
        images: imagePayloads,
        storagePaths,
        teacherId: teacher.id,
        parsePreset: coerceParsePreset(form.get("parsePreset")?.toString(), "grade_stack"),
      });
      return NextResponse.json({ phase: "preview", pages: preview.pages });
    } catch (innerError) {
      const innerMessage =
        innerError instanceof Error ? innerError.message : "Unexpected error";
      if (innerMessage === "TEST_NOT_FOUND") {
        return NextResponse.json({ error: "Test not found." }, { status: 404 });
      }
      throw innerError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
