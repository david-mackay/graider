import { db } from "@/lib/db";
import { appUsers, classes, gradeStackJobs } from "@/drizzle/schema";
import {
  FREE_TIER_CLASS_LIMIT,
  FREE_TIER_MONTHLY_GRADE_LIMIT,
  type SubscriptionLimitCode,
  type SubscriptionSummary,
  type SubscriptionTier,
} from "@/lib/subscriptions/constants";
import { and, count, eq, gte } from "drizzle-orm";

function startOfUtcMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

function resolveTier(
  storedTier: string,
  expiresAt: Date | null,
): SubscriptionTier {
  if (storedTier !== "pro") return "free";
  if (expiresAt && expiresAt.getTime() <= Date.now()) return "free";
  return "pro";
}

export async function countMonthlyStackGrades(teacherId: string): Promise<number> {
  const monthStart = startOfUtcMonth();
  const [row] = await db
    .select({ total: count() })
    .from(gradeStackJobs)
    .where(
      and(
        eq(gradeStackJobs.teacherId, teacherId),
        eq(gradeStackJobs.phase, "commit"),
        eq(gradeStackJobs.status, "completed"),
        gte(gradeStackJobs.createdAt, monthStart),
      ),
    );
  return Number(row?.total ?? 0);
}

export async function countOwnedClasses(teacherId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(classes)
    .where(eq(classes.ownerUserId, teacherId));
  return Number(row?.total ?? 0);
}

export async function getSubscriptionSummary(teacherId: string): Promise<SubscriptionSummary> {
  const [user] = await db
    .select({
      subscriptionTier: appUsers.subscriptionTier,
      subscriptionExpiresAt: appUsers.subscriptionExpiresAt,
    })
    .from(appUsers)
    .where(eq(appUsers.id, teacherId))
    .limit(1);

  const tier = resolveTier(user?.subscriptionTier ?? "free", user?.subscriptionExpiresAt ?? null);
  const isPro = tier === "pro";
  const gradesUsedThisMonth = await countMonthlyStackGrades(teacherId);
  const classesOwned = await countOwnedClasses(teacherId);

  return {
    tier,
    isPro,
    gradesUsedThisMonth,
    gradeLimit: isPro ? null : FREE_TIER_MONTHLY_GRADE_LIMIT,
    gradesRemaining: isPro
      ? null
      : Math.max(0, FREE_TIER_MONTHLY_GRADE_LIMIT - gradesUsedThisMonth),
    classesOwned,
    classLimit: isPro ? null : FREE_TIER_CLASS_LIMIT,
    subscriptionExpiresAt: user?.subscriptionExpiresAt?.toISOString() ?? null,
  };
}

export class SubscriptionLimitError extends Error {
  code: SubscriptionLimitCode;

  constructor(code: SubscriptionLimitCode, message: string) {
    super(message);
    this.code = code;
  }
}

export async function assertCanStartStackGrade(teacherId: string): Promise<SubscriptionSummary> {
  const summary = await getSubscriptionSummary(teacherId);
  if (summary.isPro) return summary;
  if (
    summary.gradeLimit !== null &&
    summary.gradesUsedThisMonth >= summary.gradeLimit
  ) {
    throw new SubscriptionLimitError(
      "GRADE_LIMIT",
      `Free plan includes ${summary.gradeLimit} tests graded per month. Upgrade to Pro for unlimited grading.`,
    );
  }
  return summary;
}

export async function assertCanCreateClass(teacherId: string): Promise<SubscriptionSummary> {
  const summary = await getSubscriptionSummary(teacherId);
  if (summary.isPro) return summary;
  if (
    summary.classLimit !== null &&
    summary.classesOwned >= summary.classLimit
  ) {
    throw new SubscriptionLimitError(
      "CLASS_LIMIT",
      `Free plan includes ${summary.classLimit} class. Upgrade to Pro for unlimited classes.`,
    );
  }
  return summary;
}

export async function setTeacherSubscription(params: {
  teacherId: string;
  tier: SubscriptionTier;
  expiresAt?: Date | null;
}) {
  await db
    .update(appUsers)
    .set({
      subscriptionTier: params.tier,
      subscriptionExpiresAt: params.expiresAt ?? null,
      subscriptionUpdatedAt: new Date(),
    })
    .where(eq(appUsers.id, params.teacherId));
}
