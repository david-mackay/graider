import { db } from "@/lib/db";
import { questionBank, testQuestions, tests } from "@/drizzle/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getOrSetJson } from "@/lib/cache/json";
import {
  CATALOG_CACHE_TTL_SECONDS,
  classQuestionsCacheKey,
  teacherQuestionsCacheKey,
} from "@/lib/cache/keys";
import type { QuestionBankQuestion } from "@/lib/types";

async function mapQuestions(
  rows: Array<typeof questionBank.$inferSelect>,
): Promise<QuestionBankQuestion[]> {
  const questionIds = rows.map((row) => row.id);
  const testLinks =
    questionIds.length === 0
      ? []
      : await db
          .select({
            questionId: testQuestions.questionId,
            testId: tests.id,
            testTitle: tests.title,
          })
          .from(testQuestions)
          .innerJoin(tests, eq(testQuestions.testId, tests.id))
          .where(inArray(testQuestions.questionId, questionIds));

  const testsByQuestion = new Map<string, Array<{ id: string; title: string }>>();
  for (const link of testLinks) {
    const list = testsByQuestion.get(link.questionId) ?? [];
    if (!list.some((test) => test.id === link.testId)) {
      list.push({ id: link.testId, title: link.testTitle });
    }
    testsByQuestion.set(link.questionId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    teacher_id: row.teacherId,
    class_id: row.classId,
    prompt: row.prompt,
    correct_answer: row.correctAnswer,
    marks: row.marks,
    topic: row.topic,
    question_type: row.questionType === "mcq" ? "mcq" : "open",
    choices: (row.choices as QuestionBankQuestion["choices"]) ?? null,
    tests: testsByQuestion.get(row.id) ?? [],
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
  }));
}

async function fetchQuestionsForTeacher(teacherId: string, classId?: string): Promise<QuestionBankQuestion[]> {
  const rows = await db
    .select()
    .from(questionBank)
    .where(
      classId
        ? and(eq(questionBank.teacherId, teacherId), eq(questionBank.classId, classId))
        : eq(questionBank.teacherId, teacherId),
    )
    .orderBy(desc(questionBank.updatedAt));

  return mapQuestions(rows);
}

export async function listQuestionsForTeacher(
  teacherId: string,
  classId?: string | null,
): Promise<QuestionBankQuestion[]> {
  const key = classId
    ? classQuestionsCacheKey(classId, teacherId)
    : teacherQuestionsCacheKey(teacherId);
  return getOrSetJson(key, CATALOG_CACHE_TTL_SECONDS, () =>
    fetchQuestionsForTeacher(teacherId, classId ?? undefined),
  );
}
