import { db } from "@/lib/db";
import { classes, classMemberships } from "@/drizzle/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { getOrSetJson } from "@/lib/cache/json";
import { CATALOG_CACHE_TTL_SECONDS, classesCacheKey } from "@/lib/cache/keys";
import { type SchoolClass } from "@/lib/types";

export { classesCacheKey };
export const CLASSES_CACHE_TTL_SECONDS = CATALOG_CACHE_TTL_SECONDS;

export type ListedClass = SchoolClass & {
  role_in_class: "teacher" | "student";
  student_count: number;
};

async function fetchClassesForUser(userId: string): Promise<ListedClass[]> {
  const studentCounts = db
    .select({
      classId: classMemberships.classId,
      count: sql<number>`count(*)::int`.as("student_count"),
    })
    .from(classMemberships)
    .where(
      and(
        eq(classMemberships.role, "student"),
        eq(classMemberships.status, "active"),
      ),
    )
    .groupBy(classMemberships.classId)
    .as("student_counts");

  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      owner_user_id: classes.ownerUserId,
      invite_code: classes.inviteCode,
      created_at: classes.createdAt,
      updated_at: classes.updatedAt,
      role_in_class: classMemberships.role,
      student_count: studentCounts.count,
    })
    .from(classMemberships)
    .innerJoin(classes, eq(classes.id, classMemberships.classId))
    .leftJoin(studentCounts, eq(studentCounts.classId, classes.id))
    .where(
      and(
        eq(classMemberships.userId, userId),
        eq(classMemberships.status, "active"),
      ),
    )
    .orderBy(desc(classes.createdAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    owner_user_id: row.owner_user_id,
    invite_code: row.invite_code,
    created_at: row.created_at?.toISOString() ?? null,
    updated_at: row.updated_at?.toISOString() ?? null,
    role_in_class: row.role_in_class as "teacher" | "student",
    student_count: Number(row.student_count) || 0,
  }));
}

export async function listClassesForUser(userId: string): Promise<ListedClass[]> {
  return getOrSetJson(classesCacheKey(userId), CLASSES_CACHE_TTL_SECONDS, () =>
    fetchClassesForUser(userId),
  );
}
