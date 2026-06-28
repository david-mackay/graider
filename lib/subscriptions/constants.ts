export const REVENUECAT_ENTITLEMENT_PRO = "pro";

export const FREE_TIER_CLASS_LIMIT = 1;
export const FREE_TIER_MONTHLY_GRADE_LIMIT = 20;

export type SubscriptionTier = "free" | "pro";

export type SubscriptionLimitCode = "GRADE_LIMIT" | "CLASS_LIMIT";

export type SubscriptionSummary = {
  tier: SubscriptionTier;
  isPro: boolean;
  gradesUsedThisMonth: number;
  gradeLimit: number | null;
  gradesRemaining: number | null;
  classesOwned: number;
  classLimit: number | null;
  subscriptionExpiresAt: string | null;
};
