"use client";

import { Card } from "@/components/shared/ui";
import CopyableError from "@/components/shared/CopyableError";
import type {
  GradingPhase,
  StudentGradingProgress,
} from "@/lib/grading-progress";
import { gradingProgressHeadline } from "@/lib/grading-progress";
import type { GradeStackJob } from "@/lib/types";

type StepGradingProgressProps = {
  phase: GradingPhase;
  testTitle: string;
  students: StudentGradingProgress[];
  activeJob: GradeStackJob | null;
  errorMessage?: string;
};

function statusColor(status: StudentGradingProgress["status"]): string {
  switch (status) {
    case "done":
      return "text-moss-deep";
    case "processing":
      return "text-pen-deep";
    case "failed":
      return "text-pen";
    default:
      return "text-ink-faint";
  }
}

function statusLabel(status: StudentGradingProgress["status"]): string {
  switch (status) {
    case "done":
      return "Done";
    case "processing":
      return "In progress";
    case "failed":
      return "Failed";
    default:
      return "Queued";
  }
}

export default function StepGradingProgress({
  phase,
  testTitle,
  students,
  activeJob,
  errorMessage,
}: StepGradingProgressProps) {
  const headline = gradingProgressHeadline(students, phase, activeJob);
  const phaseLabel = phase === "preview" ? "Reading pages" : "Grading";

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-faint">
          {phaseLabel}
        </p>
        <p className="mt-1 font-display text-lg font-semibold text-ink">{testTitle}</p>
        <p className="mt-2 text-sm text-ink-soft">{headline}</p>
        <p className="mt-1 text-xs text-ink-faint">
          You can leave this screen — we&apos;ll notify you when it&apos;s ready.
        </p>
      </Card>

      {errorMessage ? <CopyableError message={errorMessage} /> : null}

      <ul className="space-y-2">
        {students.map((student) => (
          <li
            key={student.studentId}
            className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-3 shadow-paper"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-pen-wash font-display text-sm font-bold text-pen-deep">
              {student.studentName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-semibold text-ink">
                {student.studentName}
              </p>
              <p className="text-xs text-ink-soft">
                {student.pageCount} page{student.pageCount === 1 ? "" : "s"} · {student.detail}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {student.status === "processing" ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-pen border-t-transparent" />
              ) : null}
              <span className={`text-xs font-bold ${statusColor(student.status)}`}>
                {statusLabel(student.status)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
