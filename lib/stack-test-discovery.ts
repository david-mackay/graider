import { db } from "@/lib/db";
import { questionBank, testQuestions, tests } from "@/drizzle/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { parseTestFromStackImages, type ImagePayload } from "@/lib/reducto";
import { coerceParsePreset, type DocumentParsePreset } from "@/lib/parse-presets";
import { normalizeQuestion } from "@/lib/stack-grading";
import type { OcrPage, ParsedImportQuestion, StackTestDiscovery } from "@/lib/types";

export const DRAFT_AUTO_DISCOVERY_TITLE = "Detecting test from papers…";

function collectOcrQuestionPrompts(ocrPages: OcrPage[]): string[] {
  const seen = new Set<string>();
  const prompts: string[] = [];
  for (const page of ocrPages) {
    for (const answer of page.answers) {
      const normalized = normalizeQuestion(answer.question);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      prompts.push(normalized);
    }
  }
  return prompts;
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

export async function createDraftTestForAutoDiscovery(params: {
  classId: string;
  teacherId: string;
}) {
  const [question] = await db
    .insert(questionBank)
    .values({
      teacherId: params.teacherId,
      classId: params.classId,
      prompt: "Placeholder — detecting questions from your papers",
      correctAnswer: "—",
      marks: 1,
      topic: "Auto-detect",
    })
    .returning({ id: questionBank.id });

  if (!question) {
    throw new Error("Failed to create placeholder question.");
  }

  const [test] = await db
    .insert(tests)
    .values({
      classId: params.classId,
      teacherId: params.teacherId,
      title: DRAFT_AUTO_DISCOVERY_TITLE,
    })
    .returning({ id: tests.id });

  if (!test) {
    throw new Error("Failed to create placeholder test.");
  }

  await db.insert(testQuestions).values({
    testId: test.id,
    questionId: question.id,
    sortOrder: 0,
  });

  return test.id;
}

async function replaceTestQuestions(params: {
  testId: string;
  classId: string;
  teacherId: string;
  title: string;
  questions: ParsedImportQuestion[];
}) {
  const existingLinks = await db
    .select({ questionId: testQuestions.questionId })
    .from(testQuestions)
    .where(eq(testQuestions.testId, params.testId));

  const oldQuestionIds = existingLinks.map((row) => row.questionId);
  if (oldQuestionIds.length > 0) {
    await db.delete(testQuestions).where(eq(testQuestions.testId, params.testId));
    await db
      .delete(questionBank)
      .where(
        and(
          eq(questionBank.classId, params.classId),
          eq(questionBank.teacherId, params.teacherId),
          inArray(questionBank.id, oldQuestionIds),
        ),
      );
  }

  const questionIds = await insertQuestions({
    teacherId: params.teacherId,
    classId: params.classId,
    questions: params.questions,
  });

  await db
    .update(tests)
    .set({ title: params.title, updatedAt: new Date() })
    .where(eq(tests.id, params.testId));

  await db.insert(testQuestions).values(
    questionIds.map((questionId, index) => ({
      testId: params.testId,
      questionId,
      sortOrder: index,
    })),
  );
}

async function findBestMatchingTest(params: {
  classId: string;
  teacherId: string;
  ocrPages: OcrPage[];
}) {
  const ocrPrompts = collectOcrQuestionPrompts(params.ocrPages);
  if (ocrPrompts.length === 0) {
    return null;
  }

  const classTests = await db
    .select({ id: tests.id, title: tests.title })
    .from(tests)
    .where(and(eq(tests.classId, params.classId), eq(tests.teacherId, params.teacherId)));

  let best: { testId: string; testTitle: string; score: number } | null = null;

  for (const test of classTests) {
    if (test.title === DRAFT_AUTO_DISCOVERY_TITLE) continue;

    const tqRows = await db
      .select({ prompt: questionBank.prompt })
      .from(testQuestions)
      .innerJoin(questionBank, eq(testQuestions.questionId, questionBank.id))
      .where(eq(testQuestions.testId, test.id))
      .orderBy(asc(testQuestions.sortOrder));

    const testPrompts = new Set(tqRows.map((row) => normalizeQuestion(row.prompt)));
    const matched = ocrPrompts.filter((prompt) => testPrompts.has(prompt)).length;
    const score = matched / ocrPrompts.length;

    if (!best || score > best.score) {
      best = { testId: test.id, testTitle: test.title, score };
    }
  }

  const minMatches = ocrPrompts.length === 1 ? 1 : 2;
  const minScore = ocrPrompts.length === 1 ? 1 : 0.5;
  if (!best || best.score < minScore) return null;

  const matchedCount = Math.round(best.score * ocrPrompts.length);
  if (matchedCount < minMatches) return null;

  return best;
}

export async function deleteDraftTestIfUnused(testId: string) {
  const [test] = await db
    .select({ id: tests.id, title: tests.title })
    .from(tests)
    .where(eq(tests.id, testId))
    .limit(1);
  if (!test || test.title !== DRAFT_AUTO_DISCOVERY_TITLE) return;
  await db.delete(tests).where(eq(tests.id, testId));
}

export async function discoverOrCreateTestForStack(params: {
  classId: string;
  teacherId: string;
  draftTestId: string;
  ocrPages: OcrPage[];
  images: ImagePayload[];
  parsePreset?: DocumentParsePreset | string;
}): Promise<{ discovery: StackTestDiscovery; draftTestIdToDelete: string | null }> {
  const match = await findBestMatchingTest({
    classId: params.classId,
    teacherId: params.teacherId,
    ocrPages: params.ocrPages,
  });

  if (match) {
    return {
      discovery: {
        source: "matched",
        testId: match.testId,
        testTitle: match.testTitle,
        confidence: match.score,
      },
      draftTestIdToDelete: match.testId !== params.draftTestId ? params.draftTestId : null,
    };
  }

  const parsed = await parseTestFromStackImages(
    params.images,
    coerceParsePreset(params.parsePreset, "grade_stack"),
  );
  await replaceTestQuestions({
    testId: params.draftTestId,
    classId: params.classId,
    teacherId: params.teacherId,
    title: parsed.title,
    questions: parsed.questions,
  });

  return {
    discovery: {
      source: "created",
      testId: params.draftTestId,
      testTitle: parsed.title,
      confidence: 1,
    },
    draftTestIdToDelete: null,
  };
}
