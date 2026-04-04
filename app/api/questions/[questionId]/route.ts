import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { questionBank } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { QuestionBankQuestion } from "@/lib/types";

type Params = { questionId: string };
type RouteContext = { params: Params | Promise<Params> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireRole("teacher");
    const payload = (await request.json()) as Partial<QuestionBankQuestion>;
    const { questionId } = await params;
    const classId = payload.class_id?.trim();

    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    await requireClassAccess(classId, ["teacher"]);

    const updates: Partial<{ prompt: string; correctAnswer: string; marks: number; topic: string | null }> = {};
    if (payload.prompt?.trim()) {
      updates.prompt = payload.prompt.trim();
    }
    if (payload.correct_answer?.trim()) {
      updates.correctAnswer = payload.correct_answer.trim();
    }
    if (payload.marks !== undefined) {
      const marks = Number(payload.marks);
      if (Number.isNaN(marks) || marks < 0) {
        return NextResponse.json({ error: "marks must be a valid non-negative number." }, { status: 400 });
      }
      updates.marks = marks;
    }
    if ("topic" in payload) {
      updates.topic = typeof payload.topic === "string" ? payload.topic.trim() || null : null;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    // Check ownership
    const [existing] = await db
      .select({ id: questionBank.id })
      .from(questionBank)
      .where(
        and(
          eq(questionBank.id, questionId),
          eq(questionBank.teacherId, user.id),
          eq(questionBank.classId, classId),
        ),
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }

    const [data] = await db
      .update(questionBank)
      .set(updates)
      .where(
        and(
          eq(questionBank.id, questionId),
          eq(questionBank.teacherId, user.id),
          eq(questionBank.classId, classId),
        ),
      )
      .returning();

    if (!data) {
      return NextResponse.json({ error: "Failed to update question." }, { status: 500 });
    }

    const question: QuestionBankQuestion = {
      id: data.id,
      teacher_id: data.teacherId,
      class_id: data.classId,
      prompt: data.prompt,
      correct_answer: data.correctAnswer,
      marks: data.marks,
      topic: data.topic,
      created_at: data.createdAt?.toISOString() ?? null,
      updated_at: data.updatedAt?.toISOString() ?? null,
    };

    return NextResponse.json({ question });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    await requireRole("teacher");
    await requireClassAccess(classId, ["teacher"]);
    const { questionId } = await params;

    await db
      .delete(questionBank)
      .where(
        and(
          eq(questionBank.id, questionId),
          eq(questionBank.classId, classId),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
