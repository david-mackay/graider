import { NextRequest, NextResponse } from "next/server";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { tests, testAttempts, testQuestions, attemptAnswers, classMemberships } from "@/drizzle/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { TestAttempt } from "@/lib/types";

type SubmitPayload = {
  testId?: string;
  answers?: { question_id: string; answer: string }[];
};

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

    let conditions = [inArray(testAttempts.testId, testIds)];
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

    const normalized = attempts.map((attempt) => {
      const released = testReleasedMap.get(attempt.testId) ?? false;
      const hideGrade = isStudent && attempt.status === "graded" && !released;
      return {
        id: attempt.id,
        test_id: attempt.testId,
        student_id: attempt.studentId,
        status: hideGrade ? "submitted" : attempt.status,
        total_marks: hideGrade ? null : attempt.totalMarks,
        max_marks: hideGrade ? null : attempt.maxMarks,
        submitted_at: attempt.submittedAt?.toISOString() ?? null,
        graded_at: hideGrade ? null : (attempt.gradedAt?.toISOString() ?? null),
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

    if (!testId || answers.length === 0) {
      return NextResponse.json(
        { error: "testId and at least one answer entry are required." },
        { status: 400 },
      );
    }

    const [test] = await db
      .select({ id: tests.id, classId: tests.classId })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1);

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

    const [attempt] = await db
      .insert(testAttempts)
      .values({
        testId,
        studentId: student.id,
        status: "submitted",
        submittedAt: new Date(),
      })
      .returning({ id: testAttempts.id });

    if (!attempt) {
      return NextResponse.json({ error: "Failed to create attempt." }, { status: 500 });
    }

    const answerRows = filteredAnswers.map((answer) => ({
      attemptId: attempt.id,
      questionId: answer.questionId,
      studentAnswer: answer.studentAnswer,
    }));

    try {
      await db.insert(attemptAnswers).values(answerRows);
    } catch {
      await db.delete(testAttempts).where(eq(testAttempts.id, attempt.id));
      return NextResponse.json({ error: "Failed to save answers." }, { status: 500 });
    }

    return NextResponse.json({ attempt_id: attempt.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
