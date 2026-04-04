import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { tests, testQuestions, questionBank, classMemberships } from "@/drizzle/schema";
import { eq, and, asc } from "drizzle-orm";
import { TestDetail } from "@/lib/types";

type Params = { testId: string };
type RouteContext = { params: Params | Promise<Params> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    const { testId } = await params;
    if (!testId) {
      return NextResponse.json({ error: "testId is required." }, { status: 400 });
    }

    const [test] = await db
      .select()
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
          eq(classMemberships.userId, user.id),
          eq(classMemberships.status, "active"),
        ),
      )
      .limit(1);

    if (!membership && user.role !== "teacher") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    if (user.role === "teacher") {
      await requireClassAccess(test.classId, ["teacher"]);
    }

    const relations = await db
      .select({
        questionId: testQuestions.questionId,
        sortOrder: testQuestions.sortOrder,
        prompt: questionBank.prompt,
        marks: questionBank.marks,
      })
      .from(testQuestions)
      .innerJoin(questionBank, eq(testQuestions.questionId, questionBank.id))
      .where(eq(testQuestions.testId, testId))
      .orderBy(asc(testQuestions.sortOrder));

    const questions = relations.map((row) => ({
      question_id: row.questionId,
      prompt: row.prompt,
      marks: row.marks,
      sort_order: row.sortOrder,
    }));

    const result: TestDetail = {
      id: test.id,
      title: test.title,
      class_id: test.classId,
      teacher_id: test.teacherId,
      created_at: test.createdAt?.toISOString() ?? null,
      updated_at: test.updatedAt?.toISOString() ?? null,
      questions,
    };

    return NextResponse.json({ test: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requireRole("teacher");
    const { testId } = await params;
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

    const body = (await request.json()) as {
      grades_released?: boolean;
      show_ai_feedback?: boolean;
    };

    const updates: Record<string, boolean> = {};
    if (typeof body.grades_released === "boolean") {
      updates.gradesReleased = body.grades_released;
    }
    if (typeof body.show_ai_feedback === "boolean") {
      updates.showAiFeedback = body.show_ai_feedback;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    await db.update(tests).set(updates).where(eq(tests.id, testId));

    return NextResponse.json({ success: true, ...body });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
