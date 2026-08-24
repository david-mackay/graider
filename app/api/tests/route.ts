import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { tests, testQuestions, questionBank, testAttempts } from "@/drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { TestSummary } from "@/lib/types";
import { normalizeTestStatus } from "@/lib/test-availability";
import { listClassesForUser } from "@/lib/classes/list-for-user";
import { listTestsForClass, refreshTestAvailability } from "@/lib/tests/list-for-class";
import { invalidateClassCatalog } from "@/lib/classes/invalidate";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const classFilter = searchParams.get("classId");

    const listed = await listClassesForUser(user.id);
    const scoped = classFilter ? listed.filter((row) => row.id === classFilter) : listed;
    const classIds = scoped.map((row) => row.id);

    if (classIds.length === 0) {
      return NextResponse.json({ tests: [] });
    }

    const teacherClassIds = new Set(
      listed.filter((row) => row.role_in_class === "teacher").map((row) => row.id),
    );

    const studentAttemptRows = await db
      .select({ testId: testAttempts.testId })
      .from(testAttempts)
      .where(eq(testAttempts.studentId, user.id));
    const attemptTestIds = new Set(studentAttemptRows.map((row) => row.testId));

    const perClass = await Promise.all(classIds.map((classId) => listTestsForClass(classId)));
    const result: TestSummary[] = perClass
      .flat()
      .map(refreshTestAvailability)
      .filter((test) => {
        if (teacherClassIds.has(test.class_id)) return true;
        if (attemptTestIds.has(test.id)) return true;
        return Boolean(test.available_now);
      })
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

    return NextResponse.json({ tests: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await requireRole("teacher");
    const payload = (await request.json()) as {
      title?: string;
      classId?: string;
      questionIds?: string[];
      status?: string;
      opens_at?: string | null;
      closes_at?: string | null;
      duration_minutes?: number | null;
      allow_late_submit?: boolean;
    };
    const title = payload.title?.trim();
    const classId = payload.classId?.trim();
    const questionIds = Array.isArray(payload.questionIds) ? payload.questionIds : [];

    if (!title || !classId || questionIds.length === 0) {
      return NextResponse.json(
        { error: "title, classId, and at least one questionId are required." },
        { status: 400 },
      );
    }

    await requireClassAccess(classId, ["teacher"]);

    const validQuestions = await db
      .select({ id: questionBank.id })
      .from(questionBank)
      .where(
        and(
          eq(questionBank.classId, classId),
          eq(questionBank.teacherId, teacher.id),
          inArray(questionBank.id, questionIds),
        ),
      );

    if (validQuestions.length !== questionIds.length) {
      return NextResponse.json({ error: "All questions must exist in the selected class." }, { status: 400 });
    }

    const status = normalizeTestStatus(payload.status ?? "draft");
    const opensAt = payload.opens_at ? new Date(payload.opens_at) : null;
    const closesAt = payload.closes_at ? new Date(payload.closes_at) : null;
    const durationMinutes =
      typeof payload.duration_minutes === "number" && payload.duration_minutes > 0
        ? Math.floor(payload.duration_minutes)
        : null;

    const [testRow] = await db
      .insert(tests)
      .values({
        title,
        teacherId: teacher.id,
        classId,
        gradesReleased: false,
        status,
        opensAt,
        closesAt,
        durationMinutes,
        allowLateSubmit: payload.allow_late_submit === true,
      })
      .returning({ id: tests.id });

    if (!testRow) {
      return NextResponse.json({ error: "Failed to create test." }, { status: 500 });
    }

    const testId = testRow.id;
    const mapping = questionIds.map((questionId, index) => ({
      testId,
      questionId,
      sortOrder: index,
    }));

    try {
      const data = await db.insert(testQuestions).values(mapping).returning();
      await invalidateClassCatalog(classId, teacher.id);
      return NextResponse.json({ testId, title, questions: data, classId, status });
    } catch {
      await db.delete(tests).where(eq(tests.id, testId));
      return NextResponse.json({ error: "Failed to link questions." }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
