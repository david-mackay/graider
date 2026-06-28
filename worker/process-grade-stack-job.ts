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
import { buildStackPreviewPages, commitStack, previewStack } from "@/lib/stack-grading";
import { extractHandwrittenStack } from "@/lib/openrouter";
import { discoverOrCreateTestForStack } from "@/lib/stack-test-discovery";
import { GradeStackQueueJobData } from "@/lib/grade-stack-jobs/queue";
import type { GradeStackPreviewPayload, StackAssignment } from "@/lib/types";

function enrichAssignmentsWithStoragePaths(
  assignments: StackAssignment[],
  previewJobId: string | null,
  previewPayload: GradeStackPreviewPayload | null,
): StackAssignment[] {
  if (!previewPayload?.pages?.length) return assignments;
  const pathByPageIndex = new Map(
    previewPayload.pages.map((page) => [page.pageIndex, page.storagePath ?? null]),
  );
  return assignments.map((assignment) => ({
    ...assignment,
    storagePath: assignment.storagePath ?? pathByPageIndex.get(assignment.pageIndex) ?? null,
  }));
}

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
    const ocrPages = await extractHandwrittenStack(images);

    if (input.autoDiscover) {
      const classId = input.classId ?? row.classId;
      if (!classId) {
        await failJob(data.jobId, "Class is required for smart grading.");
        return;
      }

      const discovery = await discoverOrCreateTestForStack({
        classId,
        teacherId: row.teacherId,
        draftTestId: row.testId,
        ocrPages,
        images,
      });

      const pages = await buildStackPreviewPages({
        classId,
        ocrPages,
        storagePaths,
      });

      await completePreviewJob(
        data.jobId,
        { pages, discovery },
        { testId: discovery.testId },
      );
      return;
    }

    const preview = await previewStack({
      testId: row.testId,
      images,
      storagePaths,
      teacherId: row.teacherId,
      ocrPages,
    });

    await completePreviewJob(data.jobId, { pages: preview.pages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview job failed.";
    if (message === "TEST_NOT_FOUND") {
      await failJob(data.jobId, "Test not found.");
      return;
    }
    await failJob(data.jobId, message);
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
  let previewPayload: GradeStackPreviewPayload | null = null;
  if (input.previewJobId) {
    const previewJob = await findJobById(input.previewJobId);
    previewPayload = (previewJob?.previewPayload as GradeStackPreviewPayload | null) ?? null;
  }
  const assignments = enrichAssignmentsWithStoragePaths(
    input.assignments,
    input.previewJobId,
    previewPayload,
  );

  try {
    const result = await commitStack({
      testId: row.testId,
      pages: assignments,
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
