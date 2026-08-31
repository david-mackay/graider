import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { tests, testAttempts, classMemberships } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { digitalStudentAttemptWhere } from "@/lib/attempt-queries";
import { canSubmitAttempt, getAttemptDeadline, isTestAvailableNow } from "@/lib/test-availability";
import { listDraftAnswers } from "@/lib/draft-answers";
import { assertStudentClassEnrollment } from "@/lib/submission-access-policy";

export async function POST(request: NextRequest) {
  try {
    const student = await requireRole("student");
    const payload = (await request.json()) as { testId?: string };
    const testId = payload.testId?.trim();
    if (!testId) {
      return NextResponse.json({ error: "testId is required." }, { status: 400 });
    }

    const [test] = await db.select().from(tests).where(eq(tests.id, testId)).limit(1);
    if (!test) {
      return NextResponse.json({ error: "Test not found." }, { status: 404 });
    }

    const [membership] = await db
      .select({ role: classMemberships.role })
      .from(classMemberships)
      .where(
        and(
          eq(classMemberships.classId, test.classId),
          eq(classMemberships.userId, student.id),
          eq(classMemberships.status, "active"),
          eq(classMemberships.role, "student"),
        ),
      )
      .limit(1);

    const enrolled = assertStudentClassEnrollment({
      membershipRole: membership?.role === "student" ? "student" : null,
    });
    if (!enrolled.ok) {
      return NextResponse.json({ error: enrolled.reason }, { status: enrolled.status });
    }

    const [existing] = await db
      .select()
      .from(testAttempts)
      .where(digitalStudentAttemptWhere(testId, student.id))
      .limit(1);

    if (existing) {
      // Unfinished = never submitted. Status may be "graded" if a teacher
      // accidentally AI-graded mid-attempt — still let the student continue.
      if (!existing.submittedAt) {
        if (existing.status !== "draft") {
          await db
            .update(testAttempts)
            .set({
              status: "draft",
              totalMarks: null,
              maxMarks: null,
              gradedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(testAttempts.id, existing.id));
        }
        const check = canSubmitAttempt(test, existing.startedAt);
        if (!check.ok) {
          return NextResponse.json({ error: check.reason }, { status: 403 });
        }
        const deadline = getAttemptDeadline(test, existing.startedAt);
        const answers = await listDraftAnswers(existing.id);
        return NextResponse.json({
          attempt_id: existing.id,
          status: "draft",
          started_at: existing.startedAt?.toISOString() ?? null,
          deadline_at: deadline?.toISOString() ?? null,
          duration_minutes: test.durationMinutes,
          resumed: true,
          answers,
        });
      }
      return NextResponse.json(
        { error: "You have already submitted this test.", attempt_id: existing.id },
        { status: 409 },
      );
    }

    if (!isTestAvailableNow(test)) {
      return NextResponse.json({ error: "This test is not available right now." }, { status: 403 });
    }

    const startedAt = new Date();
    try {
      const [attempt] = await db
        .insert(testAttempts)
        .values({
          testId,
          studentId: student.id,
          source: "student",
          status: "draft",
          startedAt,
        })
        .returning();

      if (!attempt) {
        return NextResponse.json({ error: "Failed to start attempt." }, { status: 500 });
      }

      const deadline = getAttemptDeadline(test, startedAt);
      return NextResponse.json({
        attempt_id: attempt.id,
        status: attempt.status,
        started_at: startedAt.toISOString(),
        deadline_at: deadline?.toISOString() ?? null,
        duration_minutes: test.durationMinutes,
        resumed: false,
        answers: [],
      });
    } catch {
      // Concurrent start race on the digital-attempt unique — resume the winner.
      const [raced] = await db
        .select()
        .from(testAttempts)
        .where(digitalStudentAttemptWhere(testId, student.id))
        .limit(1);
      if (raced && !raced.submittedAt) {
        const deadline = getAttemptDeadline(test, raced.startedAt);
        const answers = await listDraftAnswers(raced.id);
        return NextResponse.json({
          attempt_id: raced.id,
          status: "draft",
          started_at: raced.startedAt?.toISOString() ?? null,
          deadline_at: deadline?.toISOString() ?? null,
          duration_minutes: test.durationMinutes,
          resumed: true,
          answers,
        });
      }
      if (raced?.submittedAt) {
        return NextResponse.json(
          { error: "You have already submitted this test.", attempt_id: raced.id },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "Failed to start attempt." }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
