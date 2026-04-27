import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq, gte } from "drizzle-orm";
import { getCurrentUser, setUserRole } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  attemptAnswers,
  classMemberships,
  classes,
  questionBank,
  testAttempts,
  testQuestions,
  tests,
} from "@/drizzle/schema";
import {
  ONBOARDING_VAULT_VERSION,
  type OnboardingVault,
} from "@/lib/onboarding/types";
import { type OnboardingSyncResponse } from "@/lib/types";

const STARTER_CLASS_NAME = "My first class";
const STARTER_TEST_TITLE = "Sample test";

function generateInviteCode() {
  return randomUUID().split("-")[0].toUpperCase();
}

function isValidVault(input: unknown): input is OnboardingVault {
  if (!input || typeof input !== "object") return false;
  const vault = input as Partial<OnboardingVault>;
  if (vault.schemaVersion !== ONBOARDING_VAULT_VERSION) return false;
  if (typeof vault.startedAt !== "string" || vault.startedAt.length === 0) return false;
  if (!vault.answerKey) return false;
  const { prompt, correctAnswer, marks } = vault.answerKey;
  if (typeof prompt !== "string" || prompt.trim().length === 0) return false;
  if (typeof correctAnswer !== "string" || correctAnswer.trim().length === 0) return false;
  if (!Number.isInteger(marks) || marks <= 0) return false;
  if (!vault.sampleGrade) return false;
  const { marksEarned, maxMarks } = vault.sampleGrade;
  if (!Number.isInteger(marksEarned) || marksEarned < 0) return false;
  if (!Number.isInteger(maxMarks) || maxMarks <= 0) return false;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!isValidVault(body)) {
      return NextResponse.json(
        { error: "Vault payload is missing required fields." },
        { status: 400 },
      );
    }

    const vault = body as OnboardingVault;
    const startedAt = new Date(vault.startedAt);
    if (Number.isNaN(startedAt.getTime())) {
      return NextResponse.json({ error: "Invalid startedAt timestamp." }, { status: 400 });
    }

    // Switch the user to teacher (the funnel is teacher-targeted by definition).
    if (user.role !== "teacher") {
      await setUserRole("teacher");
    }
    const teacherId = user.id;

    // Idempotency lookup: an existing starter class owned by this teacher
    // created on/after startedAt - 1s suggests this sync already ran.
    const idempotencyFloor = new Date(startedAt.getTime() - 1000);
    const [existingClass] = await db
      .select({ id: classes.id, createdAt: classes.createdAt })
      .from(classes)
      .where(
        and(
          eq(classes.ownerUserId, teacherId),
          eq(classes.name, STARTER_CLASS_NAME),
          gte(classes.createdAt, idempotencyFloor),
        ),
      )
      .limit(1);

    if (existingClass) {
      const [existingTest] = await db
        .select({ id: tests.id })
        .from(tests)
        .where(and(eq(tests.classId, existingClass.id), eq(tests.title, STARTER_TEST_TITLE)))
        .limit(1);

      const [existingAttempt] = existingTest
        ? await db
            .select({ id: testAttempts.id })
            .from(testAttempts)
            .where(
              and(
                eq(testAttempts.testId, existingTest.id),
                eq(testAttempts.studentId, teacherId),
              ),
            )
            .limit(1)
        : [];

      if (existingTest && existingAttempt) {
        const response: OnboardingSyncResponse = {
          classId: existingClass.id,
          testId: existingTest.id,
          attemptId: existingAttempt.id,
          created: false,
        };
        return NextResponse.json(response);
      }
    }

    // Fresh insert — wrap in a transaction so partial failures roll back.
    const sampleGrade = vault.sampleGrade!;
    const answerKey = vault.answerKey!;
    const submittedAt = startedAt;
    const gradedAt = vault.completedAt ? new Date(vault.completedAt) : new Date();
    const studentAnswerText = sampleGrade.ocrAnswerText ?? "";

    const result = await db.transaction(async (tx) => {
      const [classRow] = await tx
        .insert(classes)
        .values({
          ownerUserId: teacherId,
          name: STARTER_CLASS_NAME,
          inviteCode: generateInviteCode(),
        })
        .returning({ id: classes.id });

      if (!classRow) throw new Error("Failed to create starter class.");

      await tx.insert(classMemberships).values({
        classId: classRow.id,
        userId: teacherId,
        role: "teacher",
        status: "active",
      });

      const [questionRow] = await tx
        .insert(questionBank)
        .values({
          teacherId,
          classId: classRow.id,
          prompt: answerKey.prompt,
          correctAnswer: answerKey.correctAnswer,
          marks: answerKey.marks,
          topic: "Sample",
        })
        .returning({ id: questionBank.id });

      if (!questionRow) throw new Error("Failed to create sample question.");

      const [testRow] = await tx
        .insert(tests)
        .values({
          classId: classRow.id,
          teacherId,
          title: STARTER_TEST_TITLE,
        })
        .returning({ id: tests.id });

      if (!testRow) throw new Error("Failed to create sample test.");

      await tx.insert(testQuestions).values({
        testId: testRow.id,
        questionId: questionRow.id,
        sortOrder: 0,
      });

      const [attemptRow] = await tx
        .insert(testAttempts)
        .values({
          testId: testRow.id,
          studentId: teacherId,
          status: "graded",
          totalMarks: Math.min(sampleGrade.marksEarned, answerKey.marks),
          maxMarks: answerKey.marks,
          submittedAt,
          gradedAt,
        })
        .returning({ id: testAttempts.id });

      if (!attemptRow) throw new Error("Failed to create sample attempt.");

      await tx.insert(attemptAnswers).values({
        attemptId: attemptRow.id,
        questionId: questionRow.id,
        studentAnswer: studentAnswerText,
        marksEarned: Math.min(sampleGrade.marksEarned, answerKey.marks),
        feedback: sampleGrade.feedback ?? null,
      });

      return { classId: classRow.id, testId: testRow.id, attemptId: attemptRow.id };
    });

    const response: OnboardingSyncResponse = {
      classId: result.classId,
      testId: result.testId,
      attemptId: result.attemptId,
      created: true,
    };
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
