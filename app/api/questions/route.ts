import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { questionBank } from "@/drizzle/schema";
import { QuestionBankQuestion } from "@/lib/types";
import { normalizeMcqChoices, validateMcqAnswerKey } from "@/lib/mcq-validation";
import { listQuestionsForTeacher } from "@/lib/questions/list-for-teacher";
import { invalidateClassCatalog } from "@/lib/classes/invalidate";

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("teacher");
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");

    if (classId) {
      await requireClassAccess(classId, ["teacher"]);
    }

    const questions = await listQuestionsForTeacher(user.id, classId);
    return NextResponse.json({ questions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("teacher");
    const payload = (await request.json()) as Partial<QuestionBankQuestion>;
    const classId = payload.class_id?.trim();
    const prompt = payload.prompt?.trim();
    const correctAnswer = payload.correct_answer?.trim();
    const marks = Number(payload.marks);
    const topic = payload.topic?.trim() || null;
    const questionType = payload.question_type === "mcq" ? "mcq" : "open";
    const choices =
      questionType === "mcq" ? normalizeMcqChoices(payload.choices as Array<{ key?: string; text?: string }> | null) : null;

    if (!classId || !prompt || !correctAnswer || Number.isNaN(marks) || marks < 0) {
      return NextResponse.json(
        { error: "classId, prompt, correct_answer and marks are required." },
        { status: 400 },
      );
    }

    let normalizedCorrectAnswer = correctAnswer;
    if (questionType === "mcq") {
      const gate = validateMcqAnswerKey({ correctAnswer, choices });
      if (!gate.ok) {
        return NextResponse.json({ error: gate.reason }, { status: 400 });
      }
      normalizedCorrectAnswer = gate.letter;
    }

    await requireClassAccess(classId, ["teacher"]);

    const [data] = await db
      .insert(questionBank)
      .values({
        teacherId: user.id,
        classId,
        prompt,
        correctAnswer: normalizedCorrectAnswer,
        marks,
        topic,
        questionType,
        choices,
      })
      .returning();

    if (!data) {
      return NextResponse.json({ error: "Failed to create question." }, { status: 500 });
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
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
