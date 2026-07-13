import { and, eq, inArray, like } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { appUsers, classMemberships, classes } from "@/drizzle/schema";
import { isRosterManagedUserId } from "@/lib/roster-students";

/**
 * Deletes the signed-in user's Graider data, then their Clerk user.
 * Teacher-owned classes cascade away; orphaned roster_* students are cleaned up.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  if (isRosterManagedUserId(userId)) {
    throw new Error("FORBIDDEN");
  }

  const ownedClasses = await db
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.ownerUserId, userId));
  const ownedClassIds = ownedClasses.map((row) => row.id);

  let rosterStudentIds: string[] = [];
  if (ownedClassIds.length > 0) {
    const rosterRows = await db
      .select({ userId: classMemberships.userId })
      .from(classMemberships)
      .where(
        and(inArray(classMemberships.classId, ownedClassIds), like(classMemberships.userId, "roster_%")),
      );
    rosterStudentIds = [...new Set(rosterRows.map((row) => row.userId))];
  }

  await db.delete(appUsers).where(eq(appUsers.id, userId));

  for (const rosterId of rosterStudentIds) {
    const [remaining] = await db
      .select({ id: classMemberships.id })
      .from(classMemberships)
      .where(eq(classMemberships.userId, rosterId))
      .limit(1);
    if (!remaining) {
      await db.delete(appUsers).where(eq(appUsers.id, rosterId));
    }
  }

  const clerk = await clerkClient();
  try {
    await clerk.users.deleteUser(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Idempotent if Clerk user was already removed.
    if (!/not.?found|404/i.test(message)) {
      throw new Error(`Clerk account deletion failed: ${message}`);
    }
  }
}
