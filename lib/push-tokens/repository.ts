import { db } from "@/lib/db";
import { pushTokens } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

export async function upsertPushToken(userId: string, expoPushToken: string, platform?: string | null) {
  await db
    .insert(pushTokens)
    .values({
      userId,
      expoPushToken,
      platform: platform ?? null,
    })
    .onConflictDoUpdate({
      target: pushTokens.expoPushToken,
      set: {
        userId,
        platform: platform ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function deletePushTokenForUser(userId: string, expoPushToken: string) {
  await db
    .delete(pushTokens)
    .where(and(eq(pushTokens.userId, userId), eq(pushTokens.expoPushToken, expoPushToken)));
}

export async function listPushTokensForUser(userId: string) {
  return db.select().from(pushTokens).where(eq(pushTokens.userId, userId));
}

export async function deletePushTokensForUser(userId: string) {
  await db.delete(pushTokens).where(eq(pushTokens.userId, userId));
}
