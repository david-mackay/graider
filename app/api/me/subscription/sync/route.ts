import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  getSubscriptionSummary,
  setTeacherSubscription,
} from "@/lib/subscriptions/limits";
import { resolveTierFromRevenueCat } from "@/lib/subscriptions/revenuecat";

export async function POST() {
  try {
    const teacher = await requireRole("teacher");
    const resolved = await resolveTierFromRevenueCat(teacher.id);
    await setTeacherSubscription({
      teacherId: teacher.id,
      tier: resolved.tier,
      expiresAt: resolved.expiresAt,
    });
    const summary = await getSubscriptionSummary(teacher.id);
    return NextResponse.json({ subscription: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : message.includes("Missing REVENUECAT_SECRET_API_KEY")
            ? 503
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
