import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { tests, testAttempts, classMemberships } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { TeacherAttemptRequest, TeacherAttemptResponse } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    await requireRole("teacher");

    const payload = (await request.json()) as Partial<TeacherAttemptRequest>;
    const testId = payload.testId?.trim();
    const studentId = payload.studentId?.trim();

    if (!testId || !studentId) {
      return NextResponse.json(
        { error: "testId and studentId are required." },
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

    await requireClassAccess(test.classId, ["teacher"]);

    const [studentMembership] = await db
      .select({ userId: classMemberships.userId })
      .from(classMemberships)
      .where(
        and(
          eq(classMemberships.classId, test.classId),
          eq(classMemberships.userId, studentId),
          eq(classMemberships.role, "student"),
          eq(classMemberships.status, "active"),
        ),
      )
      .limit(1);

    if (!studentMembership) {
      return NextResponse.json(
        { error: "Student is not an active member of this test's class." },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select({ id: testAttempts.id })
      .from(testAttempts)
      .where(
        and(
          eq(testAttempts.testId, testId),
          eq(testAttempts.studentId, studentId),
        ),
      )
      .limit(1);

    if (existing) {
      const response: TeacherAttemptResponse = {
        attempt_id: existing.id,
        created: false,
      };
      return NextResponse.json(response);
    }

    const [inserted] = await db
      .insert(testAttempts)
      .values({
        testId,
        studentId,
        status: "submitted",
        submittedAt: new Date(),
      })
      .returning({ id: testAttempts.id });

    if (!inserted) {
      return NextResponse.json({ error: "Failed to create attempt." }, { status: 500 });
    }

    const response: TeacherAttemptResponse = {
      attempt_id: inserted.id,
      created: true,
    };
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
