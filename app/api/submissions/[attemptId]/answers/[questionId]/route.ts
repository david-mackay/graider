import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  attemptAnswers,
  classMemberships,
  questionBank,
  testAttempts,
  testQuestions,
  tests,
} from "@/drizzle/schema";
import { and, eq, sql } from "drizzle-orm";

type RouteContext = { params: Promise<{ attemptId: string; questionId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireRole("teacher");
    const { attemptId, questionId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const marksRaw = body.marksEarned;
    const feedbackRaw = body.feedback;

    if (typeof marksRaw !== "number" || !Number.isFinite(marksRaw)) {
      return NextResponse.json({ error: "marksEarned must be a number." }, { status: 400 });
    }
    if (typeof feedbackRaw !== "string") {
      return NextResponse.json({ error: "feedback must be a string." }, { status: 400 });
    }

    const [attempt] = await db
      .select({
        id: testAttempts.id,
        testId: testAttempts.testId,
        studentId: testAttempts.studentId,
      })
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
      .select({ marks: questionBank.marks })
      .from(testQuestions)
      .innerJoin(questionBank, eq(testQuestions.questionId, questionBank.id))
      .where(and(eq(testQuestions.testId, attempt.testId), eq(testQuestions.questionId, questionId)))
      .limit(1);

    if (!questionLink) {
      return NextResponse.json({ error: "Question not on this test." }, { status: 404 });
    }

    const maxMarks = questionLink.marks ?? 0;
    const marksEarned = Math.max(0, Math.min(maxMarks, Math.round(marksRaw)));
    const feedback = feedbackRaw.trim() || "Teacher adjusted this grade.";

    const [updated] = await db
      .update(attemptAnswers)
      .set({
        marksEarned,
        feedback,
        gradedBy: "teacher",
        updatedAt: new Date(),
      })
      .where(and(eq(attemptAnswers.attemptId, attemptId), eq(attemptAnswers.questionId, questionId)))
      .returning({
        id: attemptAnswers.id,
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
        marks_earned: updated.marksEarned,
        feedback: updated.feedback,
        updated_at: updated.updatedAt?.toISOString() ?? null,
        graded_by: "teacher",
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
