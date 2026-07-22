import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { testAttempts, tests } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { AttemptNotSubmittedError, gradeOneAttempt } from "@/lib/grading";

type GradePayload = {
  attemptId?: string;
};

export async function POST(request: NextRequest) {
  try {
    await requireRole("teacher");
    const payload = (await request.json()) as GradePayload;
    const attemptId = payload.attemptId?.trim();
    if (!attemptId) {
      return NextResponse.json({ error: "attemptId is required." }, { status: 400 });
    }

    const [attempt] = await db
      .select({
        id: testAttempts.id,
        testId: testAttempts.testId,
        submittedAt: testAttempts.submittedAt,
      })
      .from(testAttempts)
      .where(eq(testAttempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    if (!attempt.submittedAt) {
      return NextResponse.json(
        { error: "This attempt is still in progress and cannot be graded yet." },
        { status: 409 },
      );
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

    const result = await gradeOneAttempt(attemptId, attempt.testId);

    return NextResponse.json({
      attemptId,
      total_marks: result.total_marks,
      max_marks: result.max_marks,
      grades: result.grades,
    });
  } catch (error) {
    if (error instanceof AttemptNotSubmittedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
