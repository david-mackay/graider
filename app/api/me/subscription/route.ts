import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSubscriptionSummary } from "@/lib/subscriptions/limits";
import { PRO_PLANS } from "@/lib/subscriptions/constants";

export async function GET() {
  try {
    const teacher = await requireRole("teacher");
    const summary = await getSubscriptionSummary(teacher.id);
    return NextResponse.json({
      subscription: summary,
      plans: PRO_PLANS,
      billing: {
        provider: "revenuecat",
        webConfigured: Boolean(process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY?.trim()),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
