import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { testAttempts, tests, testQuestions, questionBank, attemptAnswers, classMemberships } from "@/drizzle/schema";
import { eq, and, asc } from "drizzle-orm";

type Params = { attemptId: string };
type RouteContext = { params: Params | Promise<Params> };

type AttemptQuestionDetail = {
  question_id: string;
  prompt: string;
  student_answer: string;
  marks: number;
  marks_earned: number | null;
  feedback: string | null;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    const { attemptId } = await params;
    if (!attemptId) {
      return NextResponse.json({ error: "attemptId is required." }, { status: 400 });
    }

    const [attempt] = await db
      .select({
        id: testAttempts.id,
        testId: testAttempts.testId,
        studentId: testAttempts.studentId,
        status: testAttempts.status,
        totalMarks: testAttempts.totalMarks,
        maxMarks: testAttempts.maxMarks,
      })
      .from(testAttempts)
      .where(eq(testAttempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    const [test] = await db
      .select({ id: tests.id, title: tests.title, classId: tests.classId, gradesReleased: tests.gradesReleased, showAiFeedback: tests.showAiFeedback })
      .from(tests)
      .where(eq(tests.id, attempt.testId))
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
          eq(classMemberships.userId, user.id),
          eq(classMemberships.status, "active"),
        ),
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const isTeacher = membership.role === "teacher";
    if (!isTeacher && attempt.studentId !== user.id) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (!isTeacher && (attempt.status !== "graded" || !test.gradesReleased)) {
      return NextResponse.json({ error: "Grade not yet available." }, { status: 403 });
    }

    const tqRows = await db
      .select({
        questionId: testQuestions.questionId,
        sortOrder: testQuestions.sortOrder,
        prompt: questionBank.prompt,
        marks: questionBank.marks,
      })
      .from(testQuestions)
      .innerJoin(questionBank, eq(testQuestions.questionId, questionBank.id))
      .where(eq(testQuestions.testId, attempt.testId))
      .orderBy(asc(testQuestions.sortOrder));

    const answerRows = await db
      .select({
        questionId: attemptAnswers.questionId,
        studentAnswer: attemptAnswers.studentAnswer,
        marksEarned: attemptAnswers.marksEarned,
        feedback: attemptAnswers.feedback,
      })
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, attemptId));

    const answerByQuestion = new Map(answerRows.map((row) => [row.questionId, row]));

    const stripFeedback = !isTeacher && !test.showAiFeedback;

    const questions: AttemptQuestionDetail[] = tqRows.map((question) => {
      const answer = answerByQuestion.get(question.questionId);
      return {
        question_id: question.questionId,
        prompt: question.prompt ?? "Question unavailable.",
        student_answer: answer?.studentAnswer ?? "",
        marks: question.marks ?? 0,
        marks_earned: answer?.marksEarned ?? null,
        feedback: stripFeedback ? null : (answer?.feedback ?? null),
      };
    });

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        test_id: attempt.testId,
        test_title: test.title,
        student_id: attempt.studentId,
        status: attempt.status,
        total_marks: attempt.totalMarks,
        max_marks: attempt.maxMarks,
        test_class_id: test.classId,
        questions,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
