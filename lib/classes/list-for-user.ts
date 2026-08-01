import { db } from "@/lib/db";
import { classes, classMemberships } from "@/drizzle/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { type SchoolClass } from "@/lib/types";

export const CLASSES_CACHE_TTL_SECONDS = 30;

export type ListedClass = SchoolClass & {
  role_in_class: "teacher" | "student";
  student_count: number;
};

export function classesCacheKey(userId: string): string {
  return `classes:user:${userId}`;
}

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
  const key = classesCacheKey(userId);
  const cached = await cacheGet(key);
  if (cached) {
    try {
      return JSON.parse(cached) as ListedClass[];
    } catch {
      // Fall through to DB on corrupt cache.
    }
  }

  const result = await fetchClassesForUser(userId);
  await cacheSet(key, JSON.stringify(result), CLASSES_CACHE_TTL_SECONDS);
  return result;
}
