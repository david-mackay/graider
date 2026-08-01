import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { cancelJob, findJobById } from "@/lib/grade-stack-jobs/repository";
import { mapGradeStackJobRow } from "@/lib/grade-stack-jobs/map-job";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const teacher = await requireRole("teacher");
    const { jobId } = await context.params;
    const row = await findJobById(jobId);

    if (!row) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (row.teacherId !== teacher.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    return NextResponse.json(mapGradeStackJobRow(row));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const teacher = await requireRole("teacher");
    const { jobId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action !== "cancel") {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    const row = await findJobById(jobId);
    if (!row) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (row.teacherId !== teacher.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (
      row.status === "completed" ||
      row.status === "needs_review" ||
      row.status === "cancelled"
    ) {
      return NextResponse.json(mapGradeStackJobRow(row));
    }

    await cancelJob(jobId);
    const updated = await findJobById(jobId);
    return NextResponse.json(updated ? mapGradeStackJobRow(updated) : { id: jobId, status: "cancelled" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
