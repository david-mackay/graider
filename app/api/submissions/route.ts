import { NextRequest, NextResponse } from "next/server";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { tests, testAttempts, testQuestions, attemptAnswers, classMemberships, appUsers } from "@/drizzle/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { canSubmitAttempt, getAttemptDeadline } from "@/lib/test-availability";

type SubmitPayload = {
  testId?: string;
  attemptId?: string;
  answers?: { question_id: string; answer: string }[];
  timed_out?: boolean;
};

function displayStudentName(fullName: string | null | undefined, email: string | null | undefined): string | null {
  if (fullName?.trim()) return fullName.trim();
  if (email?.trim()) return email.trim();
  return null;
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    const memberships = await db
      .select({ classId: classMemberships.classId, role: classMemberships.role })
      .from(classMemberships)
      .where(
        and(
          eq(classMemberships.userId, user.id),
          eq(classMemberships.status, "active"),
        ),
      );

    const classIds = memberships.map((row) => row.classId);
    if (classIds.length === 0) {
      return NextResponse.json({ attempts: [] });
    }

    let targetClassIds: string[];
    if (user.role === "teacher") {
      targetClassIds = memberships
        .filter((m) => m.role === "teacher")
        .map((m) => m.classId);
      if (targetClassIds.length === 0) {
        return NextResponse.json({ attempts: [] });
      }
    } else {
      targetClassIds = classIds;
    }

    const testRows = await db
      .select({ id: tests.id, title: tests.title, gradesReleased: tests.gradesReleased })
      .from(tests)
      .where(inArray(tests.classId, targetClassIds));

    const testIds = testRows.map((row) => row.id);
    if (testIds.length === 0) {
      return NextResponse.json({ attempts: [] });
    }

    const conditions = [inArray(testAttempts.testId, testIds)];
    if (user.role !== "teacher") {
      conditions.push(eq(testAttempts.studentId, user.id));
    }

    const attempts = await db
      .select()
      .from(testAttempts)
      .where(and(...conditions))
      .orderBy(desc(testAttempts.submittedAt));

    const testTitleMap = new Map(testRows.map((row) => [row.id, row.title]));
    const testReleasedMap = new Map(testRows.map((row) => [row.id, row.gradesReleased]));
    const isStudent = user.role !== "teacher";

    const studentIds = Array.from(new Set(attempts.map((attempt) => attempt.studentId)));
    const studentNameById = new Map<string, string>();
    if (!isStudent && studentIds.length > 0) {
      const students = await db
        .select({ id: appUsers.id, fullName: appUsers.fullName, email: appUsers.email })
        .from(appUsers)
        .where(inArray(appUsers.id, studentIds));
      for (const student of students) {
        const label = displayStudentName(student.fullName, student.email);
        if (label) studentNameById.set(student.id, label);
      }
    }

    const normalized = attempts.map((attempt) => {
      const released = testReleasedMap.get(attempt.testId) ?? false;
      // Never treat as finished until the student actually submitted.
      // Premature AI grade can flip status to "graded" while still in progress.
      const unfinished = !attempt.submittedAt;
      const effectiveStatus = unfinished ? "draft" : attempt.status;
      const hideGrade = isStudent && effectiveStatus === "graded" && !released;
      return {
        id: attempt.id,
        test_id: attempt.testId,
        student_id: attempt.studentId,
        student_name: isStudent ? null : (studentNameById.get(attempt.studentId) ?? null),
        source: attempt.source,
        status: hideGrade ? "submitted" : effectiveStatus,
        total_marks: unfinished || hideGrade ? null : attempt.totalMarks,
        max_marks: unfinished || hideGrade ? null : attempt.maxMarks,
        started_at: attempt.startedAt?.toISOString() ?? null,
        submitted_at: attempt.submittedAt?.toISOString() ?? null,
        timed_out_at: attempt.timedOutAt?.toISOString() ?? null,
        graded_at: unfinished || hideGrade ? null : (attempt.gradedAt?.toISOString() ?? null),
        ocr_uploads: attempt.ocrUploads,
        test_title: testTitleMap.get(attempt.testId) ?? "Unknown test",
      };
    });

    return NextResponse.json({ attempts: normalized });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const student = await requireRole("student");
    const payload = (await request.json()) as SubmitPayload;
    const testId = payload.testId;
    const answers = Array.isArray(payload.answers) ? payload.answers : [];
    const timedOut = payload.timed_out === true;

    if (!testId || answers.length === 0) {
      return NextResponse.json(
        { error: "testId and at least one answer entry are required." },
        { status: 400 },
      );
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

    if (!membership) {
      return NextResponse.json({ error: "You are not enrolled in this class." }, { status: 403 });
    }

    let [attempt] = await db
      .select()
      .from(testAttempts)
      .where(and(eq(testAttempts.testId, testId), eq(testAttempts.studentId, student.id)))
      .limit(1);

    // Only block a second submit after a real submission. Status alone is not
    // enough — a teacher may have AI-graded a still-in-progress attempt.
    if (attempt?.submittedAt) {
      return NextResponse.json(
        { error: "You have already submitted this test.", attempt_id: attempt.id },
        { status: 409 },
      );
    }

    const startedAt = attempt?.startedAt ?? new Date();
    const check = canSubmitAttempt(test, startedAt);
    // Allow timed-out autosubmit even if slightly past deadline.
    if (!check.ok && !timedOut) {
      return NextResponse.json({ error: check.reason }, { status: 403 });
    }
    if (!check.ok && timedOut) {
      const deadline = getAttemptDeadline(test, startedAt);
      // Grace: accept timeout submits within 2 minutes of deadline
      if (deadline && Date.now() > deadline.getTime() + 120_000 && !test.allowLateSubmit) {
        return NextResponse.json({ error: check.reason }, { status: 403 });
      }
    }

    const tqRows = await db
      .select({ questionId: testQuestions.questionId })
      .from(testQuestions)
      .where(eq(testQuestions.testId, testId));

    if (tqRows.length === 0) {
      return NextResponse.json({ error: "No questions found for this test." }, { status: 400 });
    }

    const testQuestionIds = new Set(tqRows.map((row) => row.questionId));
    const filteredAnswers = answers
      .filter((answer) => testQuestionIds.has(answer.question_id))
      .map((answer) => ({
        questionId: answer.question_id,
        studentAnswer: answer.answer?.trim() ?? "",
      }));

    if (filteredAnswers.length === 0) {
      return NextResponse.json({ error: "No valid answers provided." }, { status: 400 });
    }

    const now = new Date();
    if (!attempt) {
      const [created] = await db
        .insert(testAttempts)
        .values({
          testId,
          studentId: student.id,
          source: "student",
          status: "submitted",
          startedAt,
          submittedAt: now,
          timedOutAt: timedOut ? now : null,
        })
        .returning({ id: testAttempts.id });
      if (!created) {
        return NextResponse.json({ error: "Failed to create attempt." }, { status: 500 });
      }
      attempt = { id: created.id } as typeof attempt;
    } else {
      await db
        .update(testAttempts)
        .set({
          status: "submitted",
          submittedAt: now,
          timedOutAt: timedOut ? now : null,
          // Clear any premature grade so the teacher regrades the real answers.
          totalMarks: null,
          maxMarks: null,
          gradedAt: null,
          updatedAt: now,
        })
        .where(eq(testAttempts.id, attempt.id));
    }

    const answerRows = filteredAnswers.map((answer) => ({
      attemptId: attempt!.id,
      questionId: answer.questionId,
      studentAnswer: answer.studentAnswer,
    }));

    try {
      await db.insert(attemptAnswers).values(answerRows);
    } catch {
      // If answers already exist (retry), replace
      await db.delete(attemptAnswers).where(eq(attemptAnswers.attemptId, attempt!.id));
      try {
        await db.insert(attemptAnswers).values(answerRows);
      } catch {
        return NextResponse.json({ error: "Failed to save answers." }, { status: 500 });
      }
    }

    return NextResponse.json({ attempt_id: attempt!.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
