import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import { extractHandwrittenAnswers } from "@/lib/openrouter";
import { db } from "@/lib/db";
import { testAttempts, tests, testQuestions, questionBank, attemptAnswers, ocrBatches } from "@/drizzle/schema";
import { eq, and, asc } from "drizzle-orm";

export const runtime = "nodejs";

function normalizeQuestion(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

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
      .select({ id: testAttempts.id, testId: testAttempts.testId })
      .from(testAttempts)
      .where(eq(testAttempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
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

    const answers = await extractHandwrittenAnswers(imagePayloads);

    const tqRows = await db
      .select({
        questionId: testQuestions.questionId,
        prompt: questionBank.prompt,
        qbId: questionBank.id,
      })
      .from(testQuestions)
      .innerJoin(questionBank, eq(testQuestions.questionId, questionBank.id))
      .where(eq(testQuestions.testId, attempt.testId))
      .orderBy(asc(testQuestions.sortOrder));

    const questionByNormalizedPrompt = new Map<string, string>();
    for (const row of tqRows) {
      questionByNormalizedPrompt.set(normalizeQuestion(row.prompt), row.questionId);
      questionByNormalizedPrompt.set(normalizeQuestion(row.qbId), row.questionId);
    }

    const matchRows: { questionId: string; studentAnswer: string }[] = [];
    for (const extracted of answers) {
      const match = questionByNormalizedPrompt.get(normalizeQuestion(extracted.question));
      if (!match) continue;

      matchRows.push({
        questionId: match,
        studentAnswer: extracted.answer,
      });
    }

    if (matchRows.length > 0) {
      const rows = matchRows.map((row) => ({
        attemptId,
        questionId: row.questionId,
        studentAnswer: row.studentAnswer,
      }));

      for (const row of rows) {
        await db
          .insert(attemptAnswers)
          .values(row)
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
