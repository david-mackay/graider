import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq, gte } from "drizzle-orm";
import { getCurrentUser, setUserRole } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  appUsers,
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
  normalizeAnswerKeys,
  normalizeStudents,
  type OnboardingVault,
} from "@/lib/onboarding/types";
import { type OnboardingSyncResponse } from "@/lib/types";
import { invalidateClassMemberCaches, invalidateClassCatalog } from "@/lib/classes/invalidate";

const STARTER_CLASS_NAME = "My first class";
const STARTER_TEST_TITLE = "My first test";

function generateInviteCode() {
  return randomUUID().split("-")[0].toUpperCase();
}

function isValidVault(input: unknown): input is OnboardingVault {
  if (!input || typeof input !== "object") return false;
  const vault = input as Partial<OnboardingVault>;
  if (vault.schemaVersion !== ONBOARDING_VAULT_VERSION) return false;
  if (typeof vault.startedAt !== "string" || vault.startedAt.length === 0) return false;
  const keys = normalizeAnswerKeys(vault);
  if (keys.length === 0) return false;
  const students = normalizeStudents(vault);
  if (students.length === 0) return false;
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
    const answerKeys = normalizeAnswerKeys(vault);
    const startedAt = new Date(vault.startedAt);
    if (Number.isNaN(startedAt.getTime())) {
      return NextResponse.json({ error: "Invalid startedAt timestamp." }, { status: 400 });
    }

    if (user.role !== "teacher") {
      await setUserRole("teacher");
    }
    const teacherId = user.id;

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

      if (existingTest) {
        const existingAttempts = await db
          .select({ id: testAttempts.id })
          .from(testAttempts)
          .where(eq(testAttempts.testId, existingTest.id));

        if (existingAttempts.length > 0) {
          const response: OnboardingSyncResponse = {
            classId: existingClass.id,
            testId: existingTest.id,
            attemptId: existingAttempts[0].id,
            attemptIds: existingAttempts.map((a) => a.id),
            created: false,
          };
          return NextResponse.json(response);
        }
      }
    }

    const students = normalizeStudents(vault);
    const submittedAt = startedAt;
    const gradedAt = vault.completedAt ? new Date(vault.completedAt) : new Date();
    const totalMax = answerKeys.reduce((sum, key) => sum + key.marks, 0);

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

      const questionIds: string[] = [];
      for (let index = 0; index < answerKeys.length; index += 1) {
        const key = answerKeys[index];
        const [questionRow] = await tx
          .insert(questionBank)
          .values({
            teacherId,
            classId: classRow.id,
            prompt: key.prompt,
            correctAnswer: key.correctAnswer,
            marks: key.marks,
            topic: "Onboarding",
            questionType: key.questionType === "mcq" ? "mcq" : "open",
            choices: key.choices ?? null,
          })
          .returning({ id: questionBank.id });
        if (!questionRow) throw new Error("Failed to create sample question.");
        questionIds.push(questionRow.id);
      }

      const [testRow] = await tx
        .insert(tests)
        .values({
          classId: classRow.id,
          teacherId,
          title: STARTER_TEST_TITLE,
        })
        .returning({ id: tests.id });

      if (!testRow) throw new Error("Failed to create sample test.");

      for (let index = 0; index < questionIds.length; index += 1) {
        await tx.insert(testQuestions).values({
          testId: testRow.id,
          questionId: questionIds[index],
          sortOrder: index,
        });
      }

      const attemptIds: string[] = [];
      for (const student of students) {
        const studentId = `roster_${randomUUID()}`;
        await tx.insert(appUsers).values({
          id: studentId,
          fullName: student.name,
          role: "student",
        });
        await tx.insert(classMemberships).values({
          classId: classRow.id,
          userId: studentId,
          role: "student",
          status: "active",
        });

        const perQuestion = student.grade.questions ?? [];
        const [attemptRow] = await tx
          .insert(testAttempts)
          .values({
            testId: testRow.id,
            studentId,
            status: "graded",
            totalMarks: Math.min(student.grade.marksEarned, totalMax),
            maxMarks: totalMax,
            submittedAt,
            gradedAt,
          })
          .returning({ id: testAttempts.id });

        if (!attemptRow) throw new Error("Failed to create sample attempt.");
        attemptIds.push(attemptRow.id);

        for (let index = 0; index < questionIds.length; index += 1) {
          const key = answerKeys[index];
          const graded = perQuestion[index];
          await tx.insert(attemptAnswers).values({
            attemptId: attemptRow.id,
            questionId: questionIds[index],
            studentAnswer: graded?.ocrAnswerText ?? (index === 0 ? student.grade.ocrAnswerText ?? "" : ""),
            marksEarned: Math.min(
              graded?.marksEarned ?? (index === 0 ? student.grade.marksEarned : 0),
              key.marks,
            ),
            feedback: graded?.feedback ?? (index === 0 ? student.grade.feedback ?? null : null),
          });
        }
      }

      return { classId: classRow.id, testId: testRow.id, attemptIds };
    });

    await invalidateClassMemberCaches(result.classId);
    await invalidateClassCatalog(result.classId, teacherId);

    const response: OnboardingSyncResponse = {
      classId: result.classId,
      testId: result.testId,
      attemptId: result.attemptIds[0],
      attemptIds: result.attemptIds,
      created: true,
    };
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
