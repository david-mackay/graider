import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { tests, testQuestions, questionBank, classMemberships, testAttempts } from "@/drizzle/schema";
import { eq, and, asc } from "drizzle-orm";
import { TestDetail } from "@/lib/types";
import {
  isTestAvailableNow,
  mapTestScheduleToApi,
  normalizeTestStatus,
} from "@/lib/test-availability";

type Params = { testId: string };
type RouteContext = { params: Params | Promise<Params> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    const { testId } = await params;
    if (!testId) {
      return NextResponse.json({ error: "testId is required." }, { status: 400 });
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
          eq(classMemberships.userId, user.id),
          eq(classMemberships.status, "active"),
        ),
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const isTeacher = membership.role === "teacher";
    if (isTeacher) {
      await requireClassAccess(test.classId, ["teacher"]);
    } else {
      if (!isTestAvailableNow(test)) {
        const [existingAttempt] = await db
          .select({ id: testAttempts.id })
          .from(testAttempts)
          .where(and(eq(testAttempts.testId, testId), eq(testAttempts.studentId, user.id)))
          .limit(1);
        if (!existingAttempt) {
          return NextResponse.json({ error: "This test is not available." }, { status: 403 });
        }
      }
    }

    const relations = await db
      .select({
        questionId: testQuestions.questionId,
        sortOrder: testQuestions.sortOrder,
        prompt: questionBank.prompt,
        marks: questionBank.marks,
        correctAnswer: questionBank.correctAnswer,
        questionType: questionBank.questionType,
        choices: questionBank.choices,
      })
      .from(testQuestions)
      .innerJoin(questionBank, eq(testQuestions.questionId, questionBank.id))
      .where(eq(testQuestions.testId, testId))
      .orderBy(asc(testQuestions.sortOrder));

    const questions = relations.map((row) => {
      const questionType = row.questionType === "mcq" ? "mcq" : "open";
      return {
        question_id: row.questionId,
        prompt: row.prompt,
        marks: row.marks,
        sort_order: row.sortOrder,
        question_type: questionType as "open" | "mcq",
        choices:
          questionType === "mcq"
            ? ((row.choices as Array<{ key: string; text: string }> | null) ?? null)
            : null,
        ...(isTeacher ? { correct_answer: row.correctAnswer } : {}),
      };
    });

    const schedule = mapTestScheduleToApi(test);
    const result: TestDetail = {
      id: test.id,
      title: test.title,
      class_id: test.classId,
      teacher_id: test.teacherId,
      grades_released: test.gradesReleased,
      show_ai_feedback: test.showAiFeedback,
      created_at: test.createdAt?.toISOString() ?? null,
      updated_at: test.updatedAt?.toISOString() ?? null,
      questions,
      ...schedule,
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
      .select()
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
      action?: "open_now" | "close_now" | "schedule";
      status?: string;
      opens_at?: string | null;
      closes_at?: string | null;
      duration_minutes?: number | null;
      allow_late_submit?: boolean;
      title?: string;
    };

    const updates: Partial<typeof tests.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof body.grades_released === "boolean") {
      updates.gradesReleased = body.grades_released;
    }
    if (typeof body.show_ai_feedback === "boolean") {
      updates.showAiFeedback = body.show_ai_feedback;
    }
    if (typeof body.title === "string" && body.title.trim()) {
      updates.title = body.title.trim();
    }
    if (typeof body.allow_late_submit === "boolean") {
      updates.allowLateSubmit = body.allow_late_submit;
    }

    if (body.action === "open_now") {
      updates.status = "open";
      updates.opensAt = new Date();
    } else if (body.action === "close_now") {
      updates.status = "closed";
      updates.closesAt = new Date();
    } else if (body.action === "schedule" || body.status === "scheduled") {
      updates.status = "scheduled";
      if (body.opens_at !== undefined) {
        updates.opensAt = body.opens_at ? new Date(body.opens_at) : null;
      }
      if (body.closes_at !== undefined) {
        updates.closesAt = body.closes_at ? new Date(body.closes_at) : null;
      }
      if (!updates.opensAt && !test.opensAt && body.opens_at === undefined) {
        return NextResponse.json(
          { error: "opens_at is required to schedule a test." },
          { status: 400 },
        );
      }
    } else if (body.status) {
      updates.status = normalizeTestStatus(body.status);
    }

    if (body.opens_at !== undefined && body.action !== "open_now") {
      updates.opensAt = body.opens_at ? new Date(body.opens_at) : null;
    }
    if (body.closes_at !== undefined && body.action !== "close_now") {
      updates.closesAt = body.closes_at ? new Date(body.closes_at) : null;
    }
    if (body.duration_minutes !== undefined) {
      updates.durationMinutes =
        typeof body.duration_minutes === "number" && body.duration_minutes > 0
          ? Math.floor(body.duration_minutes)
          : null;
    }

    const keys = Object.keys(updates).filter((k) => k !== "updatedAt");
    if (keys.length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const [updated] = await db
      .update(tests)
      .set(updates)
      .where(eq(tests.id, testId))
      .returning();

    return NextResponse.json({
      success: true,
      test: {
        id: updated.id,
        status: normalizeTestStatus(updated.status),
        opens_at: updated.opensAt?.toISOString() ?? null,
        closes_at: updated.closesAt?.toISOString() ?? null,
        duration_minutes: updated.durationMinutes,
        allow_late_submit: updated.allowLateSubmit,
        grades_released: updated.gradesReleased,
        show_ai_feedback: updated.showAiFeedback,
        available_now: isTestAvailableNow(updated),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
