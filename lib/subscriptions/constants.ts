export const REVENUECAT_ENTITLEMENT_PRO = "pro";

/** Product identifiers — create matching products in RevenueCat Billing (web) + App Store. */
export const PRO_MONTHLY_PRODUCT_ID = "graider_pro_monthly";
export const PRO_ANNUAL_PRODUCT_ID = "graider_pro_annual";

/** Display prices (USD). Actual charged amount comes from RevenueCat / store. */
export const PRO_MONTHLY_PRICE_USD = 24.99;
export const PRO_ANNUAL_PRICE_USD = 239.99;
export const PRO_MONTHLY_PRICE_LABEL = "$24.99/mo";
export const PRO_ANNUAL_PRICE_LABEL = "$239.99/yr";
/** Annual vs 12× monthly savings for marketing copy. */
export const PRO_ANNUAL_SAVINGS_LABEL = "Save ~20%";

export const FREE_TIER_CLASS_LIMIT = 1;
export const FREE_TIER_MONTHLY_GRADE_LIMIT = 3;

export type SubscriptionTier = "free" | "pro";

export type SubscriptionLimitCode = "GRADE_LIMIT" | "CLASS_LIMIT";

export type SubscriptionPlanId = "monthly" | "annual";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  productId: string;
  label: string;
  priceUsd: number;
  priceLabel: string;
  intervalLabel: string;
  badge?: string;
};

export const PRO_PLANS: SubscriptionPlan[] = [
  {
    id: "monthly",
    productId: PRO_MONTHLY_PRODUCT_ID,
    label: "Monthly",
    priceUsd: PRO_MONTHLY_PRICE_USD,
    priceLabel: PRO_MONTHLY_PRICE_LABEL,
    intervalLabel: "per month",
  },
  {
    id: "annual",
    productId: PRO_ANNUAL_PRODUCT_ID,
    label: "Annual",
    priceUsd: PRO_ANNUAL_PRICE_USD,
    priceLabel: PRO_ANNUAL_PRICE_LABEL,
    intervalLabel: "per year",
    badge: PRO_ANNUAL_SAVINGS_LABEL,
  },
];

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
