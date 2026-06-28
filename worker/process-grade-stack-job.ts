import {
  completeCommitJob,
  completePreviewJob,
  failJob,
  findJobById,
  incrementAttemptCount,
  updateJobStatus,
} from "@/lib/grade-stack-jobs/repository";
import { getCommitInput, getPreviewInput } from "@/lib/grade-stack-jobs/map-job";
import { loadPreviewImagesFromStorage } from "@/lib/grade-stack-jobs/load-images";
import { commitStack, previewStack } from "@/lib/stack-grading";
import { GradeStackQueueJobData } from "@/lib/grade-stack-jobs/queue";

export async function processStackPreviewJob(data: GradeStackQueueJobData) {
  const row = await findJobById(data.jobId);
  if (!row) {
    throw new Error(`Grade stack job not found: ${data.jobId}`);
  }

  await incrementAttemptCount(data.jobId);
  await updateJobStatus(data.jobId, "processing");

  try {
    const input = getPreviewInput(row);
    const images = await loadPreviewImagesFromStorage(input);
    const storagePaths = input.storagePaths.map((path) => path as string | null);

    const preview = await previewStack({
      testId: row.testId,
      images,
      storagePaths,
      teacherId: row.teacherId,
    });

    await completePreviewJob(data.jobId, { pages: preview.pages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview job failed.";
    if (message === "TEST_NOT_FOUND") {
      await failJob(data.jobId, "Test not found.");
      return;
    }
    throw error;
  }
}

export async function processStackCommitJob(data: GradeStackQueueJobData) {
  const row = await findJobById(data.jobId);
  if (!row) {
    throw new Error(`Grade stack job not found: ${data.jobId}`);
  }

  await incrementAttemptCount(data.jobId);
  await updateJobStatus(data.jobId, "processing");

  const input = getCommitInput(row);

  try {
    const result = await commitStack({
      testId: row.testId,
      pages: input.assignments,
      teacherId: row.teacherId,
    });
    await completeCommitJob(data.jobId, { results: result.results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Commit job failed.";
    if (message.startsWith("INVALID_STUDENT_IDS:")) {
      const stale = message.slice("INVALID_STUDENT_IDS:".length);
      await failJob(data.jobId, `One or more students are not active members of this class: ${stale}`);
      return;
    }
    if (message === "TEST_NOT_FOUND") {
      await failJob(data.jobId, "Test not found.");
      return;
    }
    throw error;
  }
}
