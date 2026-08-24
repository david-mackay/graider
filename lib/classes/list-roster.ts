import { db } from "@/lib/db";
import { appUsers, classMemberships } from "@/drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getOrSetJson } from "@/lib/cache/json";
import { CATALOG_CACHE_TTL_SECONDS, classRosterCacheKey } from "@/lib/cache/keys";
import type { RosterEntry } from "@/lib/types";

async function fetchClassRoster(classId: string): Promise<RosterEntry[]> {
  const memberships = await db
    .select({ userId: classMemberships.userId })
    .from(classMemberships)
    .where(
      and(
        eq(classMemberships.classId, classId),
        eq(classMemberships.role, "student"),
        eq(classMemberships.status, "active"),
      ),
    );

  if (memberships.length === 0) return [];

  const userIds = memberships.map((row) => row.userId);
  const users = await db
    .select({ id: appUsers.id, email: appUsers.email, fullName: appUsers.fullName })
    .from(appUsers)
    .where(inArray(appUsers.id, userIds));

  const roster: RosterEntry[] = users.map((user) => ({
    user_id: user.id,
    full_name: user.fullName,
    email: user.email,
  }));

  roster.sort((first, second) => {
    if (first.full_name && second.full_name) return first.full_name.localeCompare(second.full_name);
    if (first.full_name && !second.full_name) return -1;
    if (!first.full_name && second.full_name) return 1;
    return 0;
  });

  return roster;
}

export async function listClassRoster(classId: string): Promise<RosterEntry[]> {
  return getOrSetJson(classRosterCacheKey(classId), CATALOG_CACHE_TTL_SECONDS, () =>
    fetchClassRoster(classId),
  );
}
