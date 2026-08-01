import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildStudentGradingProgress,
  gradingProgressHeadline,
} from "@/lib/grading-progress";
import type { GradeStackJob } from "@/lib/types";

const students = [
  { studentId: "s1", studentName: "Ada", pageCount: 2 },
  { studentId: "s2", studentName: "Ben", pageCount: 1 },
];

function job(partial: Partial<GradeStackJob>): GradeStackJob {
  return {
    id: "job1",
    phase: "commit",
    status: "processing",
    testId: "t1",
    classId: "c1",
    attemptCount: 1,
    preview: null,
    commit: null,
    failures: [],
    error: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

describe("grading-progress", () => {
  it("marks all failed when job failed", () => {
    const rows = buildStudentGradingProgress(
      students,
      job({ status: "failed", error: "boom" }),
      "commit",
    );
    assert.equal(rows.every((r) => r.status === "failed"), true);
  });

  it("tracks commit progress per student", () => {
    const rows = buildStudentGradingProgress(
      students,
      job({
        status: "processing",
        commit: {
          results: [
            {
              studentId: "s1",
              attemptId: "a1",
              created: true,
              totalMarks: 3,
              maxMarks: 5,
              grades: [],
            },
          ],
          progress: { total: 2, completed: 1, currentStudentId: "s2" },
        },
      }),
      "commit",
    );
    assert.equal(rows[0].status, "done");
    assert.equal(rows[1].status, "processing");
    assert.match(gradingProgressHeadline(rows, "commit", job({ status: "processing" })), /Grading/);
  });
});
