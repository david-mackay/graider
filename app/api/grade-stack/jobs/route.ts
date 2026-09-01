import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listResumablePreviewJobs } from "@/lib/grade-stack-jobs/repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const teacher = await requireRole("teacher");
    const jobs = await listResumablePreviewJobs(teacher.id);
    return NextResponse.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        testId: job.testId,
        testTitle: job.testTitle,
        pageCount: job.pageCount,
        studentCount: job.studentCount,
        updatedAt: job.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
