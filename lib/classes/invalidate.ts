import { db } from "@/lib/db";
import { classMemberships } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { cacheDel, cacheDelMany } from "@/lib/cache/redis";
import { classesCacheKey } from "@/lib/classes/list-for-user";

export async function invalidateUserClasses(userId: string): Promise<void> {
  await cacheDel(classesCacheKey(userId));
}

export async function invalidateClassMemberCaches(classId: string): Promise<void> {
  const members = await db
    .select({ userId: classMemberships.userId })
    .from(classMemberships)
    .where(
      and(
        eq(classMemberships.classId, classId),
        eq(classMemberships.status, "active"),
      ),
    );

  const keys = [...new Set(members.map((row) => row.userId))].map(classesCacheKey);
  await cacheDelMany(keys);
}
