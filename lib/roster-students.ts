import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { appUsers, classMemberships } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

export function isRosterManagedUserId(userId: string): boolean {
  return userId.startsWith("roster_");
}

export function normalizeStudentName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Student name is required.");
  }
  if (trimmed.length > 120) {
    throw new Error("Student name is too long.");
  }
  return trimmed;
}

export function normalizeStudentEmail(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error("Email must be a string.");
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error("Enter a valid email address.");
  }
  return trimmed.toLowerCase();
}

export async function assertStudentInClass(classId: string, studentId: string) {
  const [membership] = await db
    .select({ userId: classMemberships.userId })
    .from(classMemberships)
    .where(
      and(
        eq(classMemberships.classId, classId),
        eq(classMemberships.userId, studentId),
        eq(classMemberships.role, "student"),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new Error("Student not found in this class.");
  }
}

export async function createClassStudent(params: {
  classId: string;
  fullName: string;
  email?: string | null;
}) {
  const fullName = normalizeStudentName(params.fullName);
  const email = normalizeStudentEmail(params.email);
  const studentId = `roster_${randomUUID()}`;

  await db.insert(appUsers).values({
    id: studentId,
    fullName,
    email,
    role: "student",
  });

  await db.insert(classMemberships).values({
    classId: params.classId,
    userId: studentId,
    role: "student",
    status: "active",
  });

  return {
    user_id: studentId,
    full_name: fullName,
    email,
    role: "student" as const,
    status: "active" as const,
  };
}

export async function updateClassStudent(params: {
  classId: string;
  studentId: string;
  fullName?: string;
  email?: string | null;
}) {
  await assertStudentInClass(params.classId, params.studentId);

  if (!isRosterManagedUserId(params.studentId)) {
    throw new Error("Signed-in student profiles can only be changed by the student.");
  }

  const patch: { fullName?: string; email?: string | null } = {};
  if (params.fullName !== undefined) {
    patch.fullName = normalizeStudentName(params.fullName);
  }
  if (params.email !== undefined) {
    patch.email = normalizeStudentEmail(params.email);
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("Nothing to update.");
  }

  const [updated] = await db
    .update(appUsers)
    .set(patch)
    .where(eq(appUsers.id, params.studentId))
    .returning({
      id: appUsers.id,
      fullName: appUsers.fullName,
      email: appUsers.email,
    });

  if (!updated) {
    throw new Error("Failed to update student.");
  }

  return {
    user_id: updated.id,
    full_name: updated.fullName,
    email: updated.email,
    role: "student" as const,
    status: "active" as const,
  };
}

export async function removeClassStudent(classId: string, studentId: string) {
  await assertStudentInClass(classId, studentId);

  await db
    .delete(classMemberships)
    .where(
      and(
        eq(classMemberships.classId, classId),
        eq(classMemberships.userId, studentId),
      ),
    );

  if (isRosterManagedUserId(studentId)) {
    const remaining = await db
      .select({ classId: classMemberships.classId })
      .from(classMemberships)
      .where(eq(classMemberships.userId, studentId))
      .limit(1);

    if (remaining.length === 0) {
      await db.delete(appUsers).where(eq(appUsers.id, studentId));
    }
  }
}
