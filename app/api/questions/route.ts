import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireClassAccess, getClassMemberships } from "@/lib/auth";
import { db } from "@/lib/db";
import { questionBank, testQuestions, tests } from "@/drizzle/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { QuestionBankQuestion } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("teacher");
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");

    let conditions = [eq(questionBank.teacherId, user.id)];

    if (classId) {
      await requireClassAccess(classId, ["teacher"]);
      conditions.push(eq(questionBank.classId, classId));
    } else {
      const memberships = await getClassMemberships();
      const classIds = memberships.filter((row) => row.role === "teacher").map((row) => row.class_id);
      if (classIds.length === 0) {
        return NextResponse.json({ questions: [] });
      }
      conditions.push(inArray(questionBank.classId, classIds));
    }

    const data = await db
      .select()
      .from(questionBank)
      .where(and(...conditions))
      .orderBy(desc(questionBank.updatedAt));

    const questionIds = data.map((row) => row.id);
    const testLinks =
      questionIds.length === 0
        ? []
        : await db
            .select({
              questionId: testQuestions.questionId,
              testId: tests.id,
              testTitle: tests.title,
            })
            .from(testQuestions)
            .innerJoin(tests, eq(testQuestions.testId, tests.id))
            .where(inArray(testQuestions.questionId, questionIds));

    const testsByQuestion = new Map<string, Array<{ id: string; title: string }>>();
    for (const link of testLinks) {
      const list = testsByQuestion.get(link.questionId) ?? [];
      if (!list.some((t) => t.id === link.testId)) {
        list.push({ id: link.testId, title: link.testTitle });
      }
      testsByQuestion.set(link.questionId, list);
    }

    const questions: QuestionBankQuestion[] = data.map((row) => ({
      id: row.id,
      teacher_id: row.teacherId,
      class_id: row.classId,
      prompt: row.prompt,
      correct_answer: row.correctAnswer,
      marks: row.marks,
      topic: row.topic,
      question_type: row.questionType === "mcq" ? "mcq" : "open",
      choices: (row.choices as QuestionBankQuestion["choices"]) ?? null,
      tests: testsByQuestion.get(row.id) ?? [],
      created_at: row.createdAt?.toISOString() ?? null,
      updated_at: row.updatedAt?.toISOString() ?? null,
    }));

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
      questionType === "mcq" && Array.isArray(payload.choices)
        ? payload.choices
            .filter(
              (c): c is { key: string; text: string } =>
                typeof c?.key === "string" && typeof c?.text === "string",
            )
            .map((c) => ({ key: c.key.trim().toUpperCase().slice(0, 1), text: c.text.trim() }))
            .filter((c) => /^[A-E]$/.test(c.key))
        : null;

    if (!classId || !prompt || !correctAnswer || Number.isNaN(marks) || marks < 0) {
      return NextResponse.json(
        { error: "classId, prompt, correct_answer and marks are required." },
        { status: 400 },
      );
    }

    await requireClassAccess(classId, ["teacher"]);

    const [data] = await db
      .insert(questionBank)
      .values({
        teacherId: user.id,
        classId,
        prompt,
        correctAnswer,
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

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
