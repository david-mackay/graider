import { db } from "@/lib/db";
import { questionBank, testQuestions, tests } from "@/drizzle/schema";
import {
  completeContentImportJob,
  failContentImportJob,
  findContentImportJob,
  updateContentImportStatus,
} from "@/lib/content-import-jobs/repository";
import {
  extractQuestionBankFromDocument,
  extractTestFromDocument,
} from "@/lib/reducto";
import { coerceParsePreset } from "@/lib/parse-presets";
import { readFile } from "@/lib/storage";
import type { ContentImportResult, ParsedImportQuestion } from "@/lib/types";
import path from "path";

function filenameFromStoragePath(storagePath: string): string {
  const base = path.basename(storagePath);
  return base || "import.pdf";
}

async function insertQuestions(params: {
  teacherId: string;
  classId: string;
  questions: ParsedImportQuestion[];
}) {
  const rows = await db
    .insert(questionBank)
    .values(
      params.questions.map((q) => ({
        teacherId: params.teacherId,
        classId: params.classId,
        prompt: q.prompt,
        correctAnswer: q.correct_answer,
        marks: q.marks,
        topic: q.topic ?? null,
        questionType: q.question_type === "mcq" ? "mcq" : "open",
        choices: q.choices ?? null,
      })),
    )
    .returning({ id: questionBank.id });
  return rows.map((row) => row.id);
}

export async function processQuestionBankImportJob(jobId: string) {
  const job = await findContentImportJob(jobId);
  if (!job) throw new Error("Import job not found.");
  if (job.kind !== "question_bank") throw new Error("Invalid job kind.");

  await updateContentImportStatus(jobId, "processing");
  try {
    const buffer = await readFile(job.storagePath);
    const questions = await extractQuestionBankFromDocument(
      {
        buffer,
        filename: filenameFromStoragePath(job.storagePath),
        mimeType: "application/pdf",
      },
      coerceParsePreset(job.parsePreset, "question_bank_import"),
    );    await insertQuestions({
      teacherId: job.teacherId,
      classId: job.classId,
      questions,
    });
    const result: ContentImportResult = { questionsCreated: questions.length };
    await completeContentImportJob(jobId, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    await failContentImportJob(jobId, message);
    throw error;
  }
}

export async function processTestImportJob(jobId: string) {
  const job = await findContentImportJob(jobId);
  if (!job) throw new Error("Import job not found.");
  if (job.kind !== "test") throw new Error("Invalid job kind.");

  await updateContentImportStatus(jobId, "processing");
  try {
    const buffer = await readFile(job.storagePath);
    const parsed = await extractTestFromDocument(
      {
        buffer,
        filename: filenameFromStoragePath(job.storagePath),
        mimeType: "application/pdf",
      },
      coerceParsePreset(job.parsePreset, "test_import"),
    );    const questionIds = await insertQuestions({
      teacherId: job.teacherId,
      classId: job.classId,
      questions: parsed.questions,
    });

    const [test] = await db
      .insert(tests)
      .values({
        classId: job.classId,
        teacherId: job.teacherId,
        title: parsed.title,
      })
      .returning();

    if (!test) throw new Error("Failed to create test.");

    await db.insert(testQuestions).values(
      questionIds.map((questionId, index) => ({
        testId: test.id,
        questionId,
        sortOrder: index,
      })),
    );

    const result: ContentImportResult = {
      testId: test.id,
      testTitle: test.title,
      questionsCreated: questionIds.length,
    };
    await completeContentImportJob(jobId, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    await failContentImportJob(jobId, message);
    throw error;
  }
}
