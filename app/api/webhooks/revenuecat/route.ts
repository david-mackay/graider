import { NextRequest, NextResponse } from "next/server";
import { setTeacherSubscription } from "@/lib/subscriptions/limits";
import { tierFromWebhookEntitlements } from "@/lib/subscriptions/revenuecat";

export const runtime = "nodejs";

type RevenueCatWebhookEvent = {
  type?: string;
  app_user_id?: string;
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  event?: RevenueCatWebhookEvent;
  subscriber?: {
    entitlements?: Record<
      string,
      {
        expires_date: string | null;
        grace_period_expires_date?: string | null;
      }
    >;
  };
};

function extractEvent(payload: RevenueCatWebhookEvent): RevenueCatWebhookEvent {
  return payload.event ?? payload;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as RevenueCatWebhookEvent;
    const event = extractEvent(payload);
    const appUserId = event.app_user_id?.trim();
    if (!appUserId) {
      return NextResponse.json({ ok: true, skipped: "missing app_user_id" });
    }

    const resolved = tierFromWebhookEntitlements(payload.subscriber?.entitlements);
    let expiresAt = resolved.expiresAt;
    if (typeof event.expiration_at_ms === "number" && event.expiration_at_ms > 0) {
      expiresAt = new Date(event.expiration_at_ms);
    }

    await setTeacherSubscription({
      teacherId: appUserId,
      tier: resolved.tier,
      expiresAt,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
