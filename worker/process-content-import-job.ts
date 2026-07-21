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
import { planTestEnrichment, type ExistingTestQuestion } from "@/lib/test-enrich";
import type { ContentImportResult, ParsedImportQuestion } from "@/lib/types";
import { and, asc, eq } from "drizzle-orm";
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

async function loadExistingTestQuestions(testId: string): Promise<ExistingTestQuestion[]> {
  const rows = await db
    .select({
      questionId: testQuestions.questionId,
      sortOrder: testQuestions.sortOrder,
      prompt: questionBank.prompt,
      correctAnswer: questionBank.correctAnswer,
      marks: questionBank.marks,
      topic: questionBank.topic,
      questionType: questionBank.questionType,
      choices: questionBank.choices,
    })
    .from(testQuestions)
    .innerJoin(questionBank, eq(testQuestions.questionId, questionBank.id))
    .where(eq(testQuestions.testId, testId))
    .orderBy(asc(testQuestions.sortOrder));

  return rows.map((row) => ({
    questionId: row.questionId,
    sortOrder: row.sortOrder,
    prompt: row.prompt,
    correctAnswer: row.correctAnswer,
    marks: row.marks,
    topic: row.topic,
    questionType: row.questionType,
    choices: (row.choices as ExistingTestQuestion["choices"]) ?? null,
  }));
}

async function applyEnrichPlan(params: {
  testId: string;
  classId: string;
  teacherId: string;
  incoming: ParsedImportQuestion[];
}): Promise<ContentImportResult> {
  const existing = await loadExistingTestQuestions(params.testId);
  const plan = planTestEnrichment(existing, params.incoming);

  for (const patch of plan.updates) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.prompt !== undefined) set.prompt = patch.prompt;
    if (patch.correctAnswer !== undefined) set.correctAnswer = patch.correctAnswer;
    if (patch.marks !== undefined) set.marks = patch.marks;
    if (patch.topic !== undefined) set.topic = patch.topic;
    if (patch.questionType !== undefined) set.questionType = patch.questionType;
    if (patch.choices !== undefined) set.choices = patch.choices;
    await db.update(questionBank).set(set).where(eq(questionBank.id, patch.questionId));
  }

  if (plan.inserts.length > 0) {
    const maxSort = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1);
    const questionIds = await insertQuestions({
      teacherId: params.teacherId,
      classId: params.classId,
      questions: plan.inserts,
    });
    await db.insert(testQuestions).values(
      questionIds.map((questionId, index) => ({
        testId: params.testId,
        questionId,
        sortOrder: maxSort + 1 + index,
      })),
    );
  }

  const [test] = await db
    .select({ id: tests.id, title: tests.title })
    .from(tests)
    .where(eq(tests.id, params.testId))
    .limit(1);

  return {
    testId: params.testId,
    testTitle: test?.title,
    questionsCreated: plan.created,
    questionsUpdated: plan.updates.length,
    questionsMatched: plan.matched,
    enriched: true,
  };
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
    );
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

async function extractQuestionsFromJobPaths(job: {
  storagePath: string;
  extraStoragePaths: string[] | null;
  parsePreset: string | null;
}): Promise<{ title: string; questions: ParsedImportQuestion[] }> {
  const paths = [job.storagePath, ...(job.extraStoragePaths ?? [])].filter(Boolean);
  let title = "Imported test";
  const allQuestions: ParsedImportQuestion[] = [];

  for (const storagePath of paths) {
    const buffer = await readFile(storagePath);
    const parsed = await extractTestFromDocument(
      {
        buffer,
        filename: filenameFromStoragePath(storagePath),
        mimeType: "application/pdf",
      },
      coerceParsePreset(job.parsePreset, "test_import"),
    );
    if (parsed.title && parsed.title !== "Imported test") {
      title = parsed.title;
    }
    allQuestions.push(...parsed.questions);
  }

  // Deduplicate by question_number when multiple PDFs contribute overlapping rows.
  const byNumber = new Map<number, ParsedImportQuestion>();
  const unnumbered: ParsedImportQuestion[] = [];
  allQuestions.forEach((q, index) => {
    const num = q.question_number && q.question_number > 0 ? q.question_number : null;
    if (num == null) {
      unnumbered.push({ ...q, question_number: index + 1 });
      return;
    }
    const prev = byNumber.get(num);
    if (!prev) {
      byNumber.set(num, q);
      return;
    }
    // Prefer the richer of the two when the same number appears in both PDFs.
    const preferIncoming =
      (q.prompt && !/^question\s+\d+$/i.test(q.prompt) && /^question\s+\d+$/i.test(prev.prompt)) ||
      (q.correct_answer &&
        q.correct_answer.trim() &&
        q.correct_answer !== "—" &&
        (!prev.correct_answer || prev.correct_answer === "—" || !prev.correct_answer.trim())) ||
      ((q.choices?.length ?? 0) > 0 && !(prev.choices?.length));
    if (preferIncoming) {
      byNumber.set(num, {
        ...prev,
        prompt: !/^question\s+\d+$/i.test(q.prompt) ? q.prompt : prev.prompt,
        correct_answer:
          q.correct_answer && q.correct_answer !== "—" ? q.correct_answer : prev.correct_answer,
        choices: q.choices?.length ? q.choices : prev.choices,
        question_type: q.question_type === "mcq" || prev.question_type === "mcq" ? "mcq" : "open",
        marks: Math.max(q.marks || 1, prev.marks || 1),
        topic: q.topic ?? prev.topic,
      });
    } else {
      byNumber.set(num, {
        ...prev,
        prompt: !/^question\s+\d+$/i.test(prev.prompt) ? prev.prompt : q.prompt,
        correct_answer:
          prev.correct_answer && prev.correct_answer !== "—"
            ? prev.correct_answer
            : q.correct_answer,
        choices: prev.choices?.length ? prev.choices : q.choices,
        question_type: q.question_type === "mcq" || prev.question_type === "mcq" ? "mcq" : "open",
        topic: prev.topic ?? q.topic,
      });
    }
  });

  const numbered = Array.from(byNumber.entries())
    .sort(([a], [b]) => a - b)
    .map(([, q]) => q);

  return { title, questions: [...numbered, ...unnumbered] };
}

export async function processTestImportJob(jobId: string) {
  const job = await findContentImportJob(jobId);
  if (!job) throw new Error("Import job not found.");
  if (job.kind !== "test") throw new Error("Invalid job kind.");

  await updateContentImportStatus(jobId, "processing");
  try {
    const parsed = await extractQuestionsFromJobPaths(job);

    if (job.targetTestId) {
      const [target] = await db
        .select({ id: tests.id, classId: tests.classId, teacherId: tests.teacherId })
        .from(tests)
        .where(
          and(
            eq(tests.id, job.targetTestId),
            eq(tests.classId, job.classId),
            eq(tests.teacherId, job.teacherId),
          ),
        )
        .limit(1);
      if (!target) throw new Error("Target test not found for enrich.");

      const result = await applyEnrichPlan({
        testId: target.id,
        classId: job.classId,
        teacherId: job.teacherId,
        incoming: parsed.questions,
      });
      await completeContentImportJob(jobId, result);
      return;
    }

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
        status: "draft",
        gradesReleased: false,
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
