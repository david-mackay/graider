import { auth } from "@clerk/nextjs/server";
import { AppRole, AppUser, ClassMembership, ClassRole } from "@/lib/types";
import { db } from "@/lib/db";
import { appUsers, classMemberships, classes } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

function toAppRole(value: string | undefined): AppRole {
  return value === "teacher" ? "teacher" : "student";
}

export async function getCurrentUser(): Promise<AppUser> {
  const session = await auth();
  if (!session?.userId) {
    throw new Error("UNAUTHORIZED");
  }

  const sessionClaims = (session.sessionClaims ?? {}) as Record<string, unknown>;
  const email = typeof sessionClaims.email === "string" ? sessionClaims.email : null;
  const fullName =
    typeof sessionClaims.name === "string"
      ? sessionClaims.name
      : typeof sessionClaims.full_name === "string"
        ? sessionClaims.full_name
        : null;
  const metadataRole =
    typeof sessionClaims.publicMetadata === "object" && sessionClaims.publicMetadata !== null
      ? (sessionClaims.publicMetadata as Record<string, unknown>).role
      : typeof sessionClaims.role === "string"
        ? sessionClaims.role
        : undefined;
  const clerkRole = typeof metadataRole === "string" ? metadataRole : undefined;

  const [existing] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.id, session.userId))
    .limit(1);

  if (!existing) {
    try {
      const [data] = await db
        .insert(appUsers)
        .values({
          id: session.userId,
          email,
          fullName: fullName ?? null,
          role: toAppRole(clerkRole),
        })
        .returning();

      if (!data) {
        throw new Error("Failed to sync Clerk user");
      }

      return {
        id: data.id,
        email: data.email,
        full_name: data.fullName,
        role: toAppRole(data.role),
      };
    } catch (error) {
      // Concurrent first requests (e.g. push-token + onboarding sync) can both
      // miss the row and race on insert — recover by re-reading.
      const [raced] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.id, session.userId))
        .limit(1);
      if (raced) {
        return {
          id: raced.id,
          email: raced.email,
          full_name: raced.fullName,
          role: toAppRole(clerkRole ?? raced.role),
        };
      }
      throw error;
    }
  }

  const updates: Partial<{ email: string | null; fullName: string | null }> = {};
  if (existing.email !== email) {
    updates.email = email;
  }
  // Sync name from Clerk if available, but don't overwrite a manually-set name with null
  if (fullName && existing.fullName !== fullName) {
    updates.fullName = fullName;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(appUsers).set(updates).where(eq(appUsers.id, session.userId));
  }

  return {
    id: session.userId,
    email: updates.email !== undefined ? updates.email : existing.email,
    full_name: updates.fullName !== undefined ? updates.fullName : existing.fullName,
    role: toAppRole(clerkRole ?? existing.role),
  };
}

export async function requireRole(requiredRole: AppRole): Promise<AppUser> {
  const user = await getCurrentUser();
  if (user.role !== requiredRole) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function setUserRole(role: AppRole): Promise<AppUser> {
  const user = await getCurrentUser();

  await db.update(appUsers).set({ role }).where(eq(appUsers.id, user.id));

  return { ...user, role };
}

export async function getClassRole(classId: string): Promise<ClassRole | null> {
  const user = await getCurrentUser();

  const [classRow] = await db
    .select({ ownerUserId: classes.ownerUserId })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  if (classRow?.ownerUserId === user.id) {
    return "teacher";
  }

  const [data] = await db
    .select({ role: classMemberships.role })
    .from(classMemberships)
    .where(
      and(
        eq(classMemberships.classId, classId),
        eq(classMemberships.userId, user.id),
        eq(classMemberships.status, "active"),
      ),
    )
    .limit(1);

  if (!data) {
    return null;
  }

  return data.role === "teacher" ? "teacher" : "student";
}

export async function requireClassAccess(classId: string, acceptedRoles: ClassRole[]): Promise<AppUser & { classRole: ClassRole }> {
  const user = await getCurrentUser();
  const role = await getClassRole(classId);

  if (!role || !acceptedRoles.includes(role)) {
    throw new Error("FORBIDDEN");
  }

  return { ...user, classRole: role };
}

export async function getClassMemberships(): Promise<ClassMembership[]> {
  const user = await getCurrentUser();

  const data = await db
    .select({
      class_id: classMemberships.classId,
      user_id: classMemberships.userId,
      role: classMemberships.role,
      status: classMemberships.status,
      created_at: classMemberships.createdAt,
    })
    .from(classMemberships)
    .where(
      and(
        eq(classMemberships.userId, user.id),
        eq(classMemberships.status, "active"),
      ),
    );

  return data.map((row) => ({
    class_id: row.class_id,
    user_id: row.user_id,
    role: row.role === "teacher" ? "teacher" : "student",
    status: row.status === "pending" ? "pending" : "active",
    created_at: row.created_at?.toISOString() ?? null,
  }));
}
