import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  attemptAnswers,
  questionBank,
  testAttempts,
  testQuestions,
  tests,
} from "@/drizzle/schema";
import { and, eq, sql } from "drizzle-orm";
import { gradeQuestion } from "@/lib/openrouter";
import { gradeMcqExact } from "@/lib/mcq";

type RouteContext = { params: Promise<{ attemptId: string; questionId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireRole("teacher");
    const { attemptId, questionId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const marksRaw = body.marksEarned;
    const feedbackRaw = body.feedback;
    const studentAnswerRaw = body.studentAnswer;

    // studentAnswer is optional — when provided we re-grade, otherwise we just patch marks/feedback
    const regradeMode = typeof studentAnswerRaw === "string";

    if (!regradeMode) {
      if (typeof marksRaw !== "number" || !Number.isFinite(marksRaw)) {
        return NextResponse.json({ error: "marksEarned must be a number." }, { status: 400 });
      }
      if (typeof feedbackRaw !== "string") {
        return NextResponse.json({ error: "feedback must be a string." }, { status: 400 });
      }
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
      .select({ id: tests.id, classId: tests.classId })
      .from(tests)
      .where(eq(tests.id, attempt.testId))
      .limit(1);

    if (!test) {
      return NextResponse.json({ error: "Test not found." }, { status: 404 });
    }

    await requireClassAccess(test.classId, ["teacher"]);

    const [questionLink] = await db
      .select({
        marks: questionBank.marks,
        correctAnswer: questionBank.correctAnswer,
        prompt: questionBank.prompt,
        questionType: questionBank.questionType,
      })
      .from(testQuestions)
      .innerJoin(questionBank, eq(testQuestions.questionId, questionBank.id))
      .where(and(eq(testQuestions.testId, attempt.testId), eq(testQuestions.questionId, questionId)))
      .limit(1);

    if (!questionLink) {
      return NextResponse.json({ error: "Question not on this test." }, { status: 404 });
    }

    const maxMarks = questionLink.marks ?? 0;

    let marksEarned: number;
    let feedback: string;
    const patch: Record<string, unknown> = { gradedBy: "teacher", updatedAt: new Date() };

    if (regradeMode) {
      const newAnswer = (studentAnswerRaw as string).trim();
      patch.studentAnswer = newAnswer;

      const grade =
        questionLink.questionType === "mcq"
          ? gradeMcqExact({
              teacherAnswer: questionLink.correctAnswer,
              studentAnswer: newAnswer,
              marks: maxMarks,
            })
          : await gradeQuestion({
              question: questionLink.prompt,
              marks: maxMarks,
              teacher_answer: questionLink.correctAnswer,
              student_answer: newAnswer,
            });

      marksEarned = grade.marks_earned;
      feedback = grade.feedback;
      patch.marksEarned = marksEarned;
      patch.feedback = feedback;
    } else {
      marksEarned = Math.max(0, Math.min(maxMarks, Math.round(marksRaw as number)));
      feedback = (feedbackRaw as string).trim() || "Teacher adjusted this grade.";
      patch.marksEarned = marksEarned;
      patch.feedback = feedback;
    }

    const [updated] = await db
      .update(attemptAnswers)
      .set(patch)
      .where(and(eq(attemptAnswers.attemptId, attemptId), eq(attemptAnswers.questionId, questionId)))
      .returning({
        id: attemptAnswers.id,
        studentAnswer: attemptAnswers.studentAnswer,
        marksEarned: attemptAnswers.marksEarned,
        feedback: attemptAnswers.feedback,
        gradedBy: attemptAnswers.gradedBy,
        updatedAt: attemptAnswers.updatedAt,
      });

    if (!updated) {
      return NextResponse.json({ error: "Answer not found for this question." }, { status: 404 });
    }

    const [totals] = await db
      .select({
        total: sql<number>`coalesce(sum(${attemptAnswers.marksEarned}), 0)`,
        maxTotal: sql<number>`coalesce(sum(${questionBank.marks}), 0)`,
      })
      .from(testQuestions)
      .innerJoin(questionBank, eq(testQuestions.questionId, questionBank.id))
      .leftJoin(
        attemptAnswers,
        and(
          eq(attemptAnswers.questionId, testQuestions.questionId),
          eq(attemptAnswers.attemptId, attemptId),
        ),
      )
      .where(eq(testQuestions.testId, attempt.testId));

    await db
      .update(testAttempts)
      .set({
        totalMarks: Number(totals?.total ?? 0),
        maxMarks: Number(totals?.maxTotal ?? 0),
        status: "graded",
        gradedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(testAttempts.id, attemptId));

    return NextResponse.json({
      answer: {
        question_id: questionId,
        student_answer: updated.studentAnswer,
        marks_earned: updated.marksEarned,
        feedback: updated.feedback,
        updated_at: updated.updatedAt?.toISOString() ?? null,
        graded_by: updated.gradedBy,
      },
      attempt: {
        total_marks: Number(totals?.total ?? 0),
        max_marks: Number(totals?.maxTotal ?? 0),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
