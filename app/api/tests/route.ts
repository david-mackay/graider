import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { tests, testQuestions, questionBank, classMemberships } from "@/drizzle/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { TestSummary } from "@/lib/types";
import { isTestAvailableNow, mapTestScheduleToApi, normalizeTestStatus } from "@/lib/test-availability";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const classFilter = searchParams.get("classId");

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
    const filteredClassIds = classFilter ? classIds.filter((id) => id === classFilter) : classIds;

    if (filteredClassIds.length === 0) {
      return NextResponse.json({ tests: [] });
    }

    const isTeacherViewer = memberships.some(
      (m) => m.role === "teacher" && filteredClassIds.includes(m.classId),
    );
    // Pure students: hide draft/closed (and outside window). Teachers see all in their classes.
    const teacherClassIds = new Set(
      memberships.filter((m) => m.role === "teacher").map((m) => m.classId),
    );

    const data = await db
      .select()
      .from(tests)
      .where(inArray(tests.classId, filteredClassIds))
      .orderBy(desc(tests.createdAt));

    const result: TestSummary[] = data
      .filter((row) => {
        if (teacherClassIds.has(row.classId)) return true;
        const schedule = mapTestScheduleToApi(row);
        if (schedule.status === "draft" || schedule.status === "closed") return false;
        return isTestAvailableNow(row) || schedule.status === "scheduled";
      })
      .map((row) => {
        const schedule = mapTestScheduleToApi(row);
        return {
          id: row.id,
          title: row.title,
          class_id: row.classId,
          teacher_id: row.teacherId,
          grades_released: row.gradesReleased,
          show_ai_feedback: row.showAiFeedback,
          created_at: row.createdAt?.toISOString() ?? null,
          updated_at: row.updatedAt?.toISOString() ?? null,
          ...schedule,
        };
      });

    void isTeacherViewer;

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
