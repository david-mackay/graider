import type { GradeStackJob, StudentPageAssignment, TestSummary } from "@/lib/types";

export function assignmentsToMap(
  assignments: StudentPageAssignment[] | undefined,
): Map<number, string> {
  const map = new Map<number, string>();
  if (!assignments) return map;
  for (const row of assignments) {
    map.set(row.pageIndex, row.studentId);
  }
  return map;
}

export function testSummaryFromJob(job: GradeStackJob, title = "Test"): TestSummary {
  return {
    id: job.testId,
    title,
    class_id: job.classId ?? "",
    teacher_id: "",
    status: "open",
    opens_at: null,
    closes_at: null,
    duration_minutes: null,
    allow_late_submit: false,
    grades_released: false,
    show_ai_feedback: false,
  };
}

export type JobResumeTarget =
  | { kind: "review"; previewJobId: string; pageToStudentId: Map<number, string> }
  | { kind: "results"; commitJobId: string }
  | { kind: "failed"; message: string }
  | { kind: "wait" };

export function resolveJobResumeTarget(job: GradeStackJob): JobResumeTarget {
  if (job.status === "failed" || job.status === "cancelled") {
    return { kind: "failed", message: job.error ?? "Grading job failed." };
  }

  if (job.phase === "preview") {
    if (job.status === "needs_review") {
      const pageToStudentId = assignmentsToMap(
        job.studentPageAssignments ?? job.preview?.studentPageAssignments,
      );
      return { kind: "review", previewJobId: job.id, pageToStudentId };
    }
    if (job.status === "queued" || job.status === "processing") {
      return { kind: "wait" };
    }
  }

  if (job.phase === "commit") {
    if (job.status === "completed" && job.commit) {
      return { kind: "results", commitJobId: job.id };
    }
    if (job.status === "queued" || job.status === "processing") {
      return { kind: "wait" };
    }
  }

  return { kind: "failed", message: "This grading job is not ready to open yet." };
}
