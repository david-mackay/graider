import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { findJobById } from "@/lib/grade-stack-jobs/repository";
import { mapGradeStackJobRow } from "@/lib/grade-stack-jobs/map-job";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireRole("teacher");
    const { jobId } = await context.params;
    const row = await findJobById(jobId);

    if (!row) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    return NextResponse.json(mapGradeStackJobRow(row));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
