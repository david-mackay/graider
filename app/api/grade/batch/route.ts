import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { testAttempts, tests } from "@/drizzle/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { AttemptNotSubmittedError, gradeOneAttempt } from "@/lib/grading";

type BatchPayload = {
  testId?: string;
};

export async function POST(request: NextRequest) {
  try {
    await requireRole("teacher");
    const payload = (await request.json()) as BatchPayload;
    const testId = payload.testId?.trim();
    if (!testId) {
      return NextResponse.json({ error: "testId is required." }, { status: 400 });
    }

    const [test] = await db
      .select({ id: tests.id, classId: tests.classId })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1);

    if (!test) {
      return NextResponse.json({ error: "Test not found." }, { status: 404 });
    }

    await requireClassAccess(test.classId, ["teacher"]);

    const submitted = await db
      .select({ id: testAttempts.id })
      .from(testAttempts)
      .where(
        and(
          eq(testAttempts.testId, testId),
          eq(testAttempts.status, "submitted"),
          isNotNull(testAttempts.submittedAt),
        ),
      );

    if (submitted.length === 0) {
      return NextResponse.json({ graded_count: 0, results: [] });
    }

    const results: Array<{ attempt_id: string; total_marks: number; max_marks: number }> = [];

    for (const attempt of submitted) {
      try {
        const result = await gradeOneAttempt(attempt.id, testId);
        results.push({
          attempt_id: result.attempt_id,
          total_marks: result.total_marks,
          max_marks: result.max_marks,
        });
      } catch (error) {
        if (error instanceof AttemptNotSubmittedError) continue;
        throw error;
      }
    }

    return NextResponse.json({ graded_count: results.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
