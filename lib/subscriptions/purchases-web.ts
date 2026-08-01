"use client";

import {
  Purchases,
  ErrorCode,
  PurchasesError,
  PackageType,
  type Offering,
  type Package,
  type PurchaseResult,
} from "@revenuecat/purchases-js";
import {
  PRO_ANNUAL_PRODUCT_ID,
  PRO_MONTHLY_PRODUCT_ID,
  REVENUECAT_ENTITLEMENT_PRO,
  type SubscriptionPlanId,
} from "@/lib/subscriptions/constants";

let configuredForUser: string | null = null;

export function getWebBillingApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY?.trim();
  return key || null;
}

export function isWebBillingConfigured(): boolean {
  return Boolean(getWebBillingApiKey());
}

/**
 * Configure (or re-identify) the Web SDK for the signed-in Clerk user.
 * Safe to call repeatedly; only reconfigures when the app user id changes.
 */
export function ensurePurchasesConfigured(appUserId: string): Purchases {
  const apiKey = getWebBillingApiKey();
  if (!apiKey) {
    throw new Error(
      "Web billing is not configured. Set NEXT_PUBLIC_REVENUECAT_WEB_API_KEY.",
    );
  }

  if (Purchases.isConfigured() && configuredForUser === appUserId) {
    return Purchases.getSharedInstance();
  }

  if (Purchases.isConfigured() && configuredForUser !== appUserId) {
    const instance = Purchases.getSharedInstance();
    void instance.changeUser(appUserId);
    configuredForUser = appUserId;
    return instance;
  }

  const purchases = Purchases.configure({
    apiKey,
    appUserId,
  });
  configuredForUser = appUserId;
  return purchases;
}

export async function fetchCurrentOffering(appUserId: string): Promise<Offering | null> {
  const purchases = ensurePurchasesConfigured(appUserId);
  const offerings = await purchases.getOfferings({ currency: "USD" });
  return offerings.current;
}

function productIdOf(pkg: Package): string {
  return pkg.webBillingProduct?.identifier ?? "";
}

export function pickPackageForPlan(
  offering: Offering | null,
  planId: SubscriptionPlanId,
): Package | null {
  if (!offering) return null;

  if (planId === "annual") {
    return (
      offering.annual ??
      offering.availablePackages.find(
        (pkg) =>
          pkg.packageType === PackageType.Annual ||
          productIdOf(pkg) === PRO_ANNUAL_PRODUCT_ID ||
          /annual|yearly/i.test(productIdOf(pkg)),
      ) ??
      null
    );
  }

  return (
    offering.monthly ??
    offering.availablePackages.find(
      (pkg) =>
        pkg.packageType === PackageType.Monthly ||
        productIdOf(pkg) === PRO_MONTHLY_PRODUCT_ID ||
        /monthly/i.test(productIdOf(pkg)),
    ) ??
    offering.availablePackages[0] ??
    null
  );
}

export async function purchasePlan(params: {
  appUserId: string;
  planId: SubscriptionPlanId;
  customerEmail?: string | null;
  htmlTarget?: HTMLElement;
}): Promise<PurchaseResult> {
  const purchases = ensurePurchasesConfigured(params.appUserId);
  const offering = await fetchCurrentOffering(params.appUserId);
  const rcPackage = pickPackageForPlan(offering, params.planId);
  if (!rcPackage) {
    throw new Error(
      params.planId === "annual"
        ? "Annual Pro is not available yet. Check RevenueCat offerings."
        : "Monthly Pro is not available yet. Check RevenueCat offerings.",
    );
  }

  return purchases.purchase({
    rcPackage,
    customerEmail: params.customerEmail ?? undefined,
    htmlTarget: params.htmlTarget,
  });
}

export function customerHasPro(result: PurchaseResult): boolean {
  return REVENUECAT_ENTITLEMENT_PRO in (result.customerInfo?.entitlements?.active ?? {});
}

export async function getManagementUrl(appUserId: string): Promise<string | null> {
  const purchases = ensurePurchasesConfigured(appUserId);
  const info = await purchases.getCustomerInfo();
  return info.managementURL ?? null;
}

export function isUserCancelledError(error: unknown): boolean {
  return error instanceof PurchasesError && error.errorCode === ErrorCode.UserCancelledError;
}

export { PurchasesError, ErrorCode };
