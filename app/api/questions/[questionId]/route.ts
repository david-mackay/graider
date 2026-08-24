import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { questionBank } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { QuestionBankQuestion } from "@/lib/types";
import { invalidateClassCatalog } from "@/lib/classes/invalidate";

type Params = { questionId: string };
type RouteContext = { params: Params | Promise<Params> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireRole("teacher");
    const payload = (await request.json()) as Partial<QuestionBankQuestion>;
    const { questionId } = await params;
    const classId =
      payload.class_id?.trim() ||
      (typeof (payload as { classId?: unknown }).classId === "string"
        ? (payload as { classId: string }).classId.trim()
        : "");

    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    await requireClassAccess(classId, ["teacher"]);

    const updates: Partial<{
      prompt: string;
      correctAnswer: string;
      marks: number;
      topic: string | null;
      questionType: string;
      choices: Array<{ key: string; text: string }> | null;
    }> = {};
    if (payload.prompt?.trim()) {
      updates.prompt = payload.prompt.trim();
    }
    const nextCorrectAnswer =
      payload.correct_answer?.trim() ||
      (typeof (payload as { correctAnswer?: unknown }).correctAnswer === "string"
        ? (payload as { correctAnswer: string }).correctAnswer.trim()
        : "");
    if (nextCorrectAnswer) {
      updates.correctAnswer = nextCorrectAnswer;
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
    if (payload.question_type === "mcq" || payload.question_type === "open") {
      updates.questionType = payload.question_type;
    }
    if ("choices" in payload) {
      if (payload.choices === null) {
        updates.choices = null;
      } else if (Array.isArray(payload.choices)) {
        updates.choices = payload.choices
          .filter(
            (c): c is { key: string; text: string } =>
              typeof c?.key === "string" && typeof c?.text === "string",
          )
          .map((c) => ({ key: c.key.trim().toUpperCase().slice(0, 1), text: c.text.trim() }))
          .filter((c) => /^[A-E]$/.test(c.key));
      }
    }

    const [existing] = await db
      .select({
        id: questionBank.id,
        questionType: questionBank.questionType,
        choices: questionBank.choices,
      })
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

    const effectiveType =
      updates.questionType === "mcq" || updates.questionType === "open"
        ? updates.questionType
        : existing.questionType === "mcq"
          ? "mcq"
          : "open";

    if (effectiveType === "mcq") {
      const raw = updates.correctAnswer ?? payload.correct_answer?.trim();
      if (raw) {
        const letter = raw.toUpperCase().match(/^([A-E])\b/)?.[1];
        if (!letter) {
          return NextResponse.json(
            { error: "MCQ correct_answer must be a letter A–E." },
            { status: 400 },
          );
        }
        const choiceKeys =
          updates.choices ??
          (Array.isArray(existing.choices)
            ? (existing.choices as Array<{ key: string; text: string }>)
            : null);
        if (choiceKeys && choiceKeys.length > 0 && !choiceKeys.some((c) => c.key === letter)) {
          return NextResponse.json(
            { error: "MCQ correct_answer must match one of the choice keys." },
            { status: 400 },
          );
        }
        updates.correctAnswer = letter;
      } else if (updates.questionType === "mcq" && payload.correct_answer !== undefined) {
        return NextResponse.json(
          { error: "MCQ correct_answer must be a letter A–E." },
          { status: 400 },
        );
      }
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
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
      question_type: data.questionType === "mcq" ? "mcq" : "open",
      choices: (data.choices as QuestionBankQuestion["choices"]) ?? null,
      created_at: data.createdAt?.toISOString() ?? null,
      updated_at: data.updatedAt?.toISOString() ?? null,
    };

    await invalidateClassCatalog(classId, user.id);
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

    await invalidateClassCatalog(classId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
