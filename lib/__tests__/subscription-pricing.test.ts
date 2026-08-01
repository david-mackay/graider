import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PRO_ANNUAL_PRICE_USD,
  PRO_MONTHLY_PRICE_USD,
  PRO_PLANS,
  PRO_ANNUAL_PRODUCT_ID,
  PRO_MONTHLY_PRODUCT_ID,
} from "@/lib/subscriptions/constants";

describe("subscription pricing catalog", () => {
  it("lists monthly $24.99 and annual $240", () => {
    assert.equal(PRO_MONTHLY_PRICE_USD, 24.99);
    assert.equal(PRO_ANNUAL_PRICE_USD, 240);
    assert.equal(PRO_MONTHLY_PRODUCT_ID, "graider_pro_monthly");
    assert.equal(PRO_ANNUAL_PRODUCT_ID, "graider_pro_annual");
    assert.equal(PRO_PLANS.length, 2);
    assert.deepEqual(
      PRO_PLANS.map((p) => p.id),
      ["monthly", "annual"],
    );
  });
});
