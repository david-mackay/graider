import { db } from "@/lib/db";
import { attemptAnswers } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export type DraftAnswerRow = {
  question_id: string;
  answer: string;
};

export async function listDraftAnswers(attemptId: string): Promise<DraftAnswerRow[]> {
  const rows = await db
    .select({
      questionId: attemptAnswers.questionId,
      studentAnswer: attemptAnswers.studentAnswer,
    })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));

  return rows.map((row) => ({
    question_id: row.questionId,
    answer: row.studentAnswer ?? "",
  }));
}
