import { findJobById } from "@/lib/grade-stack-jobs/repository";
import { sendPushToUser } from "@/lib/push-notifications";
import { db } from "@/lib/db";
import { tests } from "@/drizzle/schema";
import type { GradeStackCommitPayload } from "@/lib/types";
import { eq } from "drizzle-orm";

/** Notify the teacher when a grade-stack job reaches a terminal or actionable state. */
export async function notifyGradeStackJobUpdate(jobId: string): Promise<void> {
  const row = await findJobById(jobId);
  if (!row) return;

  const [testRow] = await db
    .select({ title: tests.title })
    .from(tests)
    .where(eq(tests.id, row.testId))
    .limit(1);
  const testTitle = testRow?.title ?? "Your test";

  if (row.phase === "preview" && row.status === "needs_review") {
    await sendPushToUser(row.teacherId, {
      title: "Pages ready to review",
      body: `${testTitle}: check OCR answers, then confirm grading.`,
      data: {
        type: "grade_stack_preview",
        jobId: row.id,
        screen: "grade",
      },
    });
    return;
  }

  if (row.phase === "commit" && row.status === "completed") {
    const commitPayload = row.commitPayload as GradeStackCommitPayload | null;
    const count = commitPayload?.results?.length ?? 0;
    await sendPushToUser(row.teacherId, {
      title: "Grading complete",
      body:
        count > 0
          ? `${testTitle}: ${count} paper${count === 1 ? "" : "s"} graded.`
          : `${testTitle}: grading finished.`,
      data: {
        type: "grade_stack_commit",
        jobId: row.id,
        screen: "grade",
      },
    });
    return;
  }

  if (row.status === "failed") {
    const detail = row.error?.trim();
    await sendPushToUser(row.teacherId, {
      title: "Grading failed",
      body: detail ? detail.slice(0, 160) : `${testTitle}: open Graider to try again.`,
      data: {
        type: "grade_stack_failed",
        jobId: row.id,
        screen: "grade",
      },
    });
  }
}
