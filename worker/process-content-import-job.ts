import { db } from "@/lib/db";
import { questionBank, testQuestions, tests } from "@/drizzle/schema";
import { extractPdfText } from "@/lib/content-import-jobs/extract-pdf";
import {
  completeContentImportJob,
  failContentImportJob,
  findContentImportJob,
  updateContentImportStatus,
} from "@/lib/content-import-jobs/repository";
import { parseQuestionBankFromText, parseTestFromText } from "@/lib/openrouter";
import type { ContentImportResult } from "@/lib/types";

async function insertQuestions(params: {
  teacherId: string;
  classId: string;
  questions: Awaited<ReturnType<typeof parseQuestionBankFromText>>;
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
    const text = await extractPdfText(job.storagePath);
    const questions = await parseQuestionBankFromText(text);
    await insertQuestions({
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
    const text = await extractPdfText(job.storagePath);
    const parsed = await parseTestFromText(text);
    const questionIds = await insertQuestions({
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
