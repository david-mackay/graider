import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import { extractHandwrittenAnswers } from "@/lib/reducto";
import { coerceParsePreset } from "@/lib/parse-presets";
import { matchOcrAnswersToQuestions } from "@/lib/stack-grading";
import { canApplyOcrToAttempt } from "@/lib/attempt-ocr-policy";
import { db } from "@/lib/db";
import { testAttempts, tests, testQuestions, questionBank, attemptAnswers, ocrBatches } from "@/drizzle/schema";
import { eq, and, asc } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 90;

function isFileLike(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function normalizeImageName(fileName: string | undefined) {
  if (!fileName) return `upload-${Date.now()}`;
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 80);
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await requireRole("teacher");
    const form = await request.formData();
    const attemptId = form.get("attemptId")?.toString();
    const files = form.getAll("images");

    if (!attemptId || files.length === 0) {
      return NextResponse.json({ error: "attemptId and images are required." }, { status: 400 });
    }

    const [attempt] = await db
      .select({
        id: testAttempts.id,
        testId: testAttempts.testId,
        source: testAttempts.source,
        submittedAt: testAttempts.submittedAt,
      })
      .from(testAttempts)
      .where(eq(testAttempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    const ocrGate = canApplyOcrToAttempt({
      source: attempt.source,
      submittedAt: attempt.submittedAt,
    });
    if (!ocrGate.ok) {
      return NextResponse.json({ error: ocrGate.reason }, { status: ocrGate.status });
    }

    const [test] = await db
      .select({ classId: tests.classId })
      .from(tests)
      .where(eq(tests.id, attempt.testId))
      .limit(1);

    if (!test) {
      return NextResponse.json({ error: "Test not found." }, { status: 404 });
    }

    await requireClassAccess(test.classId, ["teacher"]);

    const imagePayloads: { filename: string; mimeType: string; base64: string }[] = [];
    const storedPaths: string[] = [];

    for (const fileInput of files) {
      if (!isFileLike(fileInput)) {
        continue;
      }
      const buffer = Buffer.from(await fileInput.arrayBuffer());
      const extensionMatch = fileInput.name?.match(/(\.[a-zA-Z0-9]+)$/);
      const fileName = `${attemptId}/${Date.now()}-${normalizeImageName(fileInput.name)}`;
      const uploadPath = `${fileName}${extensionMatch ? "" : ".png"}`;

      await uploadFile(uploadPath, buffer, fileInput.type || "image/png");
      storedPaths.push(uploadPath);

      imagePayloads.push({
        filename: fileInput.name,
        mimeType: fileInput.type || "image/png",
        base64: buffer.toString("base64"),
      });
    }

    const answers = await extractHandwrittenAnswers(
      imagePayloads,
      coerceParsePreset(form.get("parsePreset")?.toString(), "student_ocr"),
    );

    const tqRows = await db
      .select({
        questionId: testQuestions.questionId,
        prompt: questionBank.prompt,
      })
      .from(testQuestions)
      .innerJoin(questionBank, eq(testQuestions.questionId, questionBank.id))
      .where(eq(testQuestions.testId, attempt.testId))
      .orderBy(asc(testQuestions.sortOrder));

    const matchRows = matchOcrAnswersToQuestions(answers, tqRows);

    if (matchRows.length > 0) {
      for (const row of matchRows) {
        await db
          .insert(attemptAnswers)
          .values({
            attemptId,
            questionId: row.questionId,
            studentAnswer: row.studentAnswer,
          })
          .onConflictDoUpdate({
            target: [attemptAnswers.attemptId, attemptAnswers.questionId],
            set: { studentAnswer: row.studentAnswer },
          });
      }
    }

    // Update ocr_uploads on the attempt
    const [existingAttempt] = await db
      .select({ ocrUploads: testAttempts.ocrUploads })
      .from(testAttempts)
      .where(eq(testAttempts.id, attemptId))
      .limit(1);

    if (existingAttempt) {
      const nextUploads = [...(existingAttempt.ocrUploads ?? []), ...storedPaths];
      await db
        .update(testAttempts)
        .set({ ocrUploads: nextUploads })
        .where(eq(testAttempts.id, attemptId));
    }

    await db.insert(ocrBatches).values({
      attemptId,
      graderTeacherId: teacher.id,
      payload: { images: storedPaths.length, answers },
    });

    return NextResponse.json({
      attemptId,
      uploadedFiles: storedPaths,
      extracted: answers,
      matched: matchRows.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
