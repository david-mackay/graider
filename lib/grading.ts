import { gradeQuestion } from "@/lib/openrouter";
import { gradeMcqExact } from "@/lib/mcq";
import { gradeAttributionForQuestionType } from "@/lib/grade-attribution";
import { db } from "@/lib/db";
import { testAttempts, testQuestions, questionBank, attemptAnswers } from "@/drizzle/schema";
import { eq, asc } from "drizzle-orm";

export type GradeAttemptResult = {
  attempt_id: string;
  total_marks: number;
  max_marks: number;
  grades: Array<{ question_id: string; marks_earned: number; feedback: string }>;
};

export class AttemptNotSubmittedError extends Error {
  constructor() {
    super("This attempt is still in progress and cannot be graded yet.");
    this.name = "AttemptNotSubmittedError";
  }
}

export async function gradeOneAttempt(attemptId: string, testId: string): Promise<GradeAttemptResult> {
  const [attempt] = await db
    .select({
      id: testAttempts.id,
      submittedAt: testAttempts.submittedAt,
    })
    .from(testAttempts)
    .where(eq(testAttempts.id, attemptId))
    .limit(1);

  if (!attempt) {
    throw new Error("Attempt not found.");
  }
  if (!attempt.submittedAt) {
    throw new AttemptNotSubmittedError();
  }

  const tqRows = await db
    .select({
      questionId: testQuestions.questionId,
      prompt: questionBank.prompt,
      correctAnswer: questionBank.correctAnswer,
      marks: questionBank.marks,
      questionType: questionBank.questionType,
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

  const gradeRows: {
    id: string;
    marksEarned: number;
    feedback: string;
    gradedBy: "exact" | "ai";
  }[] = [];
  const graded: Array<{ question_id: string; marks_earned: number; feedback: string }> = [];
  let earnedTotal = 0;
  let maxTotal = 0;

  for (const question of tqRows) {
    const answer = answerByQuestion.get(question.questionId);
    const studentAnswer = (answer?.studentAnswer ?? "").trim();
    const isMcq = question.questionType === "mcq";

    const grade =
      studentAnswer.length === 0
        ? {
            marks_earned: 0,
            feedback: "No student answer was read for this question.",
          }
        : isMcq
          ? gradeMcqExact({
              teacherAnswer: question.correctAnswer,
              studentAnswer,
              marks: question.marks,
            })
          : await gradeQuestion({
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
        gradedBy: gradeAttributionForQuestionType(question.questionType),
      });
    } else {
      const [inserted] = await db
        .insert(attemptAnswers)
        .values({
          attemptId,
          questionId: question.questionId,
          studentAnswer,
          marksEarned: grade.marks_earned,
          feedback: grade.feedback,
          gradedBy: gradeAttributionForQuestionType(question.questionType),
          updatedAt: new Date(),
        })
        .returning({ id: attemptAnswers.id });
      if (inserted) {
        gradeRows.push({
          id: inserted.id,
          marksEarned: grade.marks_earned,
          feedback: grade.feedback,
          gradedBy: gradeAttributionForQuestionType(question.questionType),
        });
      }
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
        gradedBy: row.gradedBy,
        updatedAt: new Date(),
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
