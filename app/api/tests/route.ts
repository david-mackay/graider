import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { tests, testQuestions, questionBank, classMemberships } from "@/drizzle/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { TestSummary } from "@/lib/types";

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

    const data = await db
      .select()
      .from(tests)
      .where(inArray(tests.classId, filteredClassIds))
      .orderBy(desc(tests.createdAt));

    const result: TestSummary[] = data.map((row) => ({
      id: row.id,
      title: row.title,
      class_id: row.classId,
      teacher_id: row.teacherId,
      grades_released: row.gradesReleased,
      show_ai_feedback: row.showAiFeedback,
      created_at: row.createdAt?.toISOString() ?? null,
      updated_at: row.updatedAt?.toISOString() ?? null,
    }));

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

    const [testRow] = await db
      .insert(tests)
      .values({ title, teacherId: teacher.id, classId, gradesReleased: false })
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
      const data = await db
        .insert(testQuestions)
        .values(mapping)
        .returning();

      return NextResponse.json({ testId, title, questions: data, classId });
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
