import { db } from "@/lib/db";
import { appUsers, classMemberships } from "@/drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { getOrSetJson } from "@/lib/cache/json";
import { CATALOG_CACHE_TTL_SECONDS, classMembersCacheKey } from "@/lib/cache/keys";

export type ClassMember = {
  user_id: string;
  role: "teacher" | "student";
  status: "active" | "pending";
  full_name: string | null;
  email: string | null;
};

async function fetchClassMembers(classId: string): Promise<ClassMember[]> {
  const memberships = await db
    .select({
      userId: classMemberships.userId,
      role: classMemberships.role,
      status: classMemberships.status,
    })
    .from(classMemberships)
    .where(eq(classMemberships.classId, classId));

  if (memberships.length === 0) return [];

  const userIds = memberships.map((row) => row.userId);
  const users = await db
    .select({ id: appUsers.id, email: appUsers.email, fullName: appUsers.fullName })
    .from(appUsers)
    .where(inArray(appUsers.id, userIds));

  const userById = new Map(users.map((user) => [user.id, user]));

  const members: ClassMember[] = memberships.map((row) => {
    const user = userById.get(row.userId);
    return {
      user_id: row.userId,
      role: row.role === "teacher" ? "teacher" : "student",
      status: row.status === "pending" ? "pending" : "active",
      full_name: user?.fullName ?? null,
      email: user?.email ?? null,
    };
  });

  members.sort((first, second) => {
    if (first.role === "teacher" && second.role === "student") return -1;
    if (first.role === "student" && second.role === "teacher") return 1;
    return first.full_name && second.full_name ? first.full_name.localeCompare(second.full_name) : 0;
  });

  return members;
}

export async function listClassMembers(classId: string): Promise<ClassMember[]> {
  return getOrSetJson(classMembersCacheKey(classId), CATALOG_CACHE_TTL_SECONDS, () =>
    fetchClassMembers(classId),
  );
}
