import { NextResponse } from "next/server";
import { requireClassAccess } from "@/lib/auth";
import { findContentImportJob } from "@/lib/content-import-jobs/repository";
import type { ContentImportResult } from "@/lib/types";

type Params = { classId: string; jobId: string };
type RouteContext = { params: Params | Promise<Params> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { classId, jobId } = await params;
    if (!classId || !jobId) {
      return NextResponse.json({ error: "classId and jobId are required." }, { status: 400 });
    }

    await requireClassAccess(classId, ["teacher"]);
    const job = await findContentImportJob(jobId);
    if (!job || job.classId !== classId || job.kind !== "test") {
      return NextResponse.json({ error: "Import job not found." }, { status: 404 });
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      result: (job.resultPayload as ContentImportResult | null) ?? undefined,
      error: job.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
