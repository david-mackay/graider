import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { attemptAnswers, testAttempts, testQuestions, tests } from "@/drizzle/schema";
import { and, eq, isNull } from "drizzle-orm";
import { canSubmitAttempt } from "@/lib/test-availability";
import { assertAttemptOwnership, assertDraftMutable } from "@/lib/submission-access-policy";

type Params = { attemptId: string };
type RouteContext = { params: Params | Promise<Params> };

type DraftAnswer = { question_id?: string; answer?: string };

/**
 * Upsert in-progress answers for a student's own draft attempt.
 * Does not submit; gated by the same schedule/deadline rules as submit.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const student = await requireRole("student");
    const { attemptId } = await params;
    if (!attemptId) {
      return NextResponse.json({ error: "attemptId is required." }, { status: 400 });
    }

    const payload = (await request.json()) as { answers?: DraftAnswer[] };
    const answers = Array.isArray(payload.answers) ? payload.answers : [];
    if (answers.length === 0) {
      return NextResponse.json({ error: "answers are required." }, { status: 400 });
    }

    const [attempt] = await db
      .select({
        id: testAttempts.id,
        testId: testAttempts.testId,
        studentId: testAttempts.studentId,
        startedAt: testAttempts.startedAt,
        submittedAt: testAttempts.submittedAt,
        source: testAttempts.source,
      })
      .from(testAttempts)
      .where(eq(testAttempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    const owned = assertAttemptOwnership({
      actorId: student.id,
      attemptStudentId: attempt.studentId,
    });
    if (!owned.ok) {
      return NextResponse.json({ error: owned.reason }, { status: owned.status });
    }

    const mutable = assertDraftMutable({ submittedAt: attempt.submittedAt });
    if (!mutable.ok) {
      return NextResponse.json({ error: mutable.reason }, { status: mutable.status });
    }

    const [test] = await db.select().from(tests).where(eq(tests.id, attempt.testId)).limit(1);
    if (!test) {
      return NextResponse.json({ error: "Test not found." }, { status: 404 });
    }

    const check = canSubmitAttempt(test, attempt.startedAt);
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: 403 });
    }

    const tqRows = await db
      .select({ questionId: testQuestions.questionId })
      .from(testQuestions)
      .where(eq(testQuestions.testId, attempt.testId));

    const allowed = new Set(tqRows.map((row) => row.questionId));
    const now = new Date();
    const rows = answers
      .filter((entry) => typeof entry.question_id === "string" && allowed.has(entry.question_id))
      .map((entry) => ({
        attemptId: attempt.id,
        questionId: entry.question_id as string,
        studentAnswer: typeof entry.answer === "string" ? entry.answer : "",
        updatedAt: now,
      }));

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid answers provided." }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      // Re-check not submitted inside the transaction.
      const [stillDraft] = await tx
        .select({ id: testAttempts.id })
        .from(testAttempts)
        .where(and(eq(testAttempts.id, attempt.id), isNull(testAttempts.submittedAt)))
        .limit(1);

      if (!stillDraft) {
        throw new Error("ALREADY_SUBMITTED");
      }

      for (const row of rows) {
        await tx
          .insert(attemptAnswers)
          .values({
            attemptId: row.attemptId,
            questionId: row.questionId,
            studentAnswer: row.studentAnswer,
            updatedAt: row.updatedAt,
          })
          .onConflictDoUpdate({
            target: [attemptAnswers.attemptId, attemptAnswers.questionId],
            set: {
              studentAnswer: row.studentAnswer,
              // Never carry grades onto a draft autosave.
              marksEarned: null,
              feedback: null,
              gradedBy: null,
              updatedAt: row.updatedAt,
            },
          });
      }

      await tx
        .update(testAttempts)
        .set({ updatedAt: now, status: "draft" })
        .where(and(eq(testAttempts.id, attempt.id), isNull(testAttempts.submittedAt)));
    });

    return NextResponse.json({
      saved: true,
      saved_at: now.toISOString(),
      answer_count: rows.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_SUBMITTED") {
      return NextResponse.json(
        { error: "This test has already been submitted." },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
