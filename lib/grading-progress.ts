import type { GradeStackJob, StackPerStudentResult } from "@/lib/types";

export type StudentGradingStatus = "queued" | "processing" | "done" | "failed";

export type StudentGradingProgress = {
  studentId: string;
  studentName: string;
  pageCount: number;
  status: StudentGradingStatus;
  detail: string;
  totalMarks?: number;
  maxMarks?: number;
};

export type GradingPhase = "preview" | "commit";

export type GradingSessionStudent = {
  studentId: string;
  studentName: string;
  pageCount: number;
};

function latestResultByStudent(results: StackPerStudentResult[]): Map<string, StackPerStudentResult> {
  const map = new Map<string, StackPerStudentResult>();
  for (const entry of results) {
    map.set(entry.studentId, entry);
  }
  return map;
}

export function buildStudentGradingProgress(
  students: GradingSessionStudent[],
  job: GradeStackJob | null,
  phase: GradingPhase,
): StudentGradingProgress[] {
  if (!job) {
    return students.map((student) => ({
      ...student,
      status: "queued",
      detail: "Waiting to start",
    }));
  }

  if (job.status === "failed" || job.status === "cancelled") {
    const message = job.error ?? "Job failed";
    return students.map((student) => ({
      ...student,
      status: "failed",
      detail: message,
    }));
  }

  if (phase === "preview") {
    if (job.status === "needs_review") {
      return students.map((student) => ({
        ...student,
        status: "done",
        detail: "Pages read",
      }));
    }
    if (job.status === "processing") {
      const previewProgress = job.preview?.progress;
      const doneIds = new Set(previewProgress?.completedStudentIds ?? []);
      return students.map((student) => {
        if (doneIds.has(student.studentId)) {
          return { ...student, status: "done" as const, detail: "Pages read" };
        }
        if (previewProgress?.currentStudentId === student.studentId) {
          return { ...student, status: "processing" as const, detail: "Reading pages" };
        }
        if (doneIds.size > 0 || previewProgress?.currentStudentId) {
          return { ...student, status: "queued" as const, detail: "Waiting" };
        }
        return { ...student, status: "processing" as const, detail: "Reading pages" };
      });
    }
    return students.map((student) => ({
      ...student,
      status: "queued",
      detail: "Waiting to start",
    }));
  }

  const resultsByStudent = latestResultByStudent(job.commit?.results ?? []);
  const progress = job.commit?.progress;
  const currentStudentId = progress?.currentStudentId ?? null;

  if (job.status === "completed") {
    return students.map((student) => {
      const result = resultsByStudent.get(student.studentId);
      return {
        ...student,
        status: "done",
        detail: result ? `${result.totalMarks}/${result.maxMarks}` : "Graded",
        totalMarks: result?.totalMarks,
        maxMarks: result?.maxMarks,
      };
    });
  }

  return students.map((student) => {
    const result = resultsByStudent.get(student.studentId);
    if (result) {
      return {
        ...student,
        status: "done",
        detail: `${result.totalMarks}/${result.maxMarks}`,
        totalMarks: result.totalMarks,
        maxMarks: result.maxMarks,
      };
    }
    if (job.status === "processing" && currentStudentId === student.studentId) {
      return {
        ...student,
        status: "processing",
        detail: "Grading answers",
      };
    }
    return {
      ...student,
      status: "queued",
      detail: "Waiting",
    };
  });
}

export function gradingProgressHeadline(
  students: StudentGradingProgress[],
  phase: GradingPhase,
  job: GradeStackJob | null,
): string {
  if (!job) return phase === "preview" ? "Starting OCR…" : "Starting grading…";

  if (job.status === "failed" || job.status === "cancelled") {
    return job.error ?? "Something went wrong";
  }

  const doneCount = students.filter((student) => student.status === "done").length;
  const total = students.length;

  if (phase === "preview") {
    if (job.status === "needs_review") return "Pages ready for review";
    if (job.status === "processing") {
      const previewProgress = job.preview?.progress;
      if (previewProgress && previewProgress.total === 100) {
        return `Reading pages (${previewProgress.completed}%)`;
      }
      if (previewProgress && previewProgress.total > 0) {
        return `Reading pages (${previewProgress.completed}/${previewProgress.total})`;
      }
      return `Reading pages (${doneCount}/${total} ready)`;
    }
    return "Queued — OCR will start shortly";
  }

  if (job.status === "completed") return `Finished grading ${doneCount} student${doneCount === 1 ? "" : "s"}`;
  if (job.status === "processing") {
    return `Grading students (${doneCount}/${total} done)`;
  }
  return "Queued — grading will start shortly";
}

export function gradingProgressPercent(
  students: StudentGradingProgress[],
  phase: GradingPhase,
  job: GradeStackJob | null,
): number {
  if (!job) return 0;
  if (job.status === "needs_review" || job.status === "completed") return 100;
  if (job.status === "failed" || job.status === "cancelled") return 0;
  if (phase === "preview") {
    const previewProgress = job.preview?.progress;
    if (previewProgress && previewProgress.total > 0) {
      return Math.min(100, Math.round((previewProgress.completed / previewProgress.total) * 100));
    }
    return 0;
  }
  const commitProgress = job.commit?.progress;
  if (commitProgress && commitProgress.total > 0) {
    return Math.min(100, Math.round((commitProgress.completed / commitProgress.total) * 100));
  }
  const done = students.filter((student) => student.status === "done").length;
  return students.length === 0 ? 0 : Math.round((done / students.length) * 100);
}

