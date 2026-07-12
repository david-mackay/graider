import { NextResponse } from "next/server";
import { getHealthReport } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public readiness probe for API, database, and grade-stack worker connectivity. */
export async function GET() {
  const report = await getHealthReport();
  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
