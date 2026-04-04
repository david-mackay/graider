import { gradeQuestion } from "@/lib/openrouter";
import { db } from "@/lib/db";
import { testAttempts, testQuestions, questionBank, attemptAnswers } from "@/drizzle/schema";
import { eq, asc } from "drizzle-orm";

export type GradeAttemptResult = {
  attempt_id: string;
  total_marks: number;
  max_marks: number;
  grades: Array<{ question_id: string; marks_earned: number; feedback: string }>;
};

export async function gradeOneAttempt(attemptId: string, testId: string): Promise<GradeAttemptResult> {
  const tqRows = await db
    .select({
      questionId: testQuestions.questionId,
      prompt: questionBank.prompt,
      correctAnswer: questionBank.correctAnswer,
      marks: questionBank.marks,
    })
    .from(testQuestions)
    .innerJoin(questionBank, eq(testQuestions.questionId, questionBank.id))
    .where(eq(testQuestions.testId, testId))
    .orderBy(asc(testQuestions.sortOrder));

  const answerRows = await db
    .select({
      id: attemptAnswers.id,
      questionId: attemptAnswers.questionId,
      studentAnswer: attemptAnswers.studentAnswer,
    })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));

  const answerByQuestion = new Map(
    answerRows.map((answer) => [answer.questionId, answer]),
  );

  const gradeRows: { id: string; marksEarned: number; feedback: string }[] = [];
  const graded: Array<{ question_id: string; marks_earned: number; feedback: string }> = [];
  let earnedTotal = 0;
  let maxTotal = 0;

  for (const question of tqRows) {
    const answer = answerByQuestion.get(question.questionId);
    const studentAnswer = answer?.studentAnswer ?? "";

    const grade = await gradeQuestion({
      question: question.prompt,
      marks: question.marks,
      teacher_answer: question.correctAnswer,
      student_answer: studentAnswer,
    });

    maxTotal += question.marks;
    earnedTotal += grade.marks_earned;

    if (answer) {
      gradeRows.push({
        id: answer.id,
        marksEarned: grade.marks_earned,
        feedback: grade.feedback,
      });
    }

    graded.push({
      question_id: question.questionId,
      marks_earned: grade.marks_earned,
      feedback: grade.feedback,
    });
  }

  for (const row of gradeRows) {
    await db
      .update(attemptAnswers)
      .set({
        marksEarned: row.marksEarned,
        feedback: row.feedback,
      })
      .where(eq(attemptAnswers.id, row.id));
  }

  await db
    .update(testAttempts)
    .set({
      status: "graded",
      totalMarks: earnedTotal,
      maxMarks: maxTotal,
      gradedAt: new Date(),
    })
    .where(eq(testAttempts.id, attemptId));

  return {
    attempt_id: attemptId,
    total_marks: earnedTotal,
    max_marks: maxTotal,
    grades: graded,
  };
}
