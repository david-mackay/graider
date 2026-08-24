import { db } from "@/lib/db";
import { classMemberships } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { cacheDel, cacheDelMany } from "@/lib/cache/redis";
import {
  classMembersCacheKey,
  classQuestionsCacheKey,
  classRosterCacheKey,
  classTestsCacheKey,
  classesCacheKey,
  teacherQuestionsCacheKey,
} from "@/lib/cache/keys";

export async function invalidateUserClasses(userId: string): Promise<void> {
  await cacheDel(classesCacheKey(userId));
}

export async function invalidateClassMemberCaches(classId: string): Promise<void> {
  const members = await db
    .select({ userId: classMemberships.userId, role: classMemberships.role })
    .from(classMemberships)
    .where(
      and(
        eq(classMemberships.classId, classId),
        eq(classMemberships.status, "active"),
      ),
    );

  const keys = [
    classMembersCacheKey(classId),
    classRosterCacheKey(classId),
    ...new Set(members.map((row) => classesCacheKey(row.userId))),
  ];
  await cacheDelMany(keys);
}

export async function invalidateClassCatalog(classId: string, teacherId?: string): Promise<void> {
  const teacherIds = teacherId
    ? [teacherId]
    : (
        await db
          .select({ userId: classMemberships.userId })
          .from(classMemberships)
          .where(
            and(
              eq(classMemberships.classId, classId),
              eq(classMemberships.role, "teacher"),
              eq(classMemberships.status, "active"),
            ),
          )
      ).map((row) => row.userId);

  const keys = [
    classTestsCacheKey(classId),
    ...teacherIds.flatMap((id) => [classQuestionsCacheKey(classId, id), teacherQuestionsCacheKey(id)]),
  ];
  await cacheDelMany(keys);
}
