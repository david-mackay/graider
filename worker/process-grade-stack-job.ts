import {
  completeCommitJob,
  completePreviewJob,
  failJob,
  findJobById,
  incrementAttemptCount,
  updateCommitProgress,
  updateJobStatus,
} from "@/lib/grade-stack-jobs/repository";
import { getCommitInput, getPreviewInput } from "@/lib/grade-stack-jobs/map-job";
import { loadPreviewImagesFromStorage } from "@/lib/grade-stack-jobs/load-images";
import {
  buildStackPreviewPages,
  buildStudentFirstPreviewPages,
  commitStack,
  firstStudentPageIndices,
  previewStack,
} from "@/lib/stack-grading";
import { extractHandwrittenStack, extractStudentFirstPreview } from "@/lib/reducto";
import { coerceParsePreset } from "@/lib/parse-presets";
import { discoverOrCreateTestForStack, deleteDraftTestIfUnused } from "@/lib/stack-test-discovery";
import { notifyGradeStackJobUpdate } from "@/lib/grade-stack-jobs/notify";
import { GradeStackQueueJobData } from "@/lib/grade-stack-jobs/queue";
import type { GradeStackPreviewPayload, StackAssignment } from "@/lib/types";

async function notifyJobSafely(jobId: string) {
  try {
    await notifyGradeStackJobUpdate(jobId);
  } catch (error) {
    console.error("[push] notify failed for job", jobId, error);
  }
}

function enrichAssignmentsWithStoragePaths(
  assignments: StackAssignment[],
  previewPayload: GradeStackPreviewPayload | null,
  previewStoragePaths: (string | null)[] = [],
): StackAssignment[] {
  const pathByPageIndex = new Map<number, string | null>();
  for (const page of previewPayload?.pages ?? []) {
    pathByPageIndex.set(page.pageIndex, page.storagePath ?? null);
  }
  return assignments.map((assignment) => {
    const fromJob = previewStoragePaths[assignment.pageIndex];
    const fromPreview = pathByPageIndex.get(assignment.pageIndex);
    const resolved =
      (typeof fromJob === "string" && fromJob.trim() ? fromJob : null) ??
      (typeof assignment.storagePath === "string" && assignment.storagePath.trim()
        ? assignment.storagePath
        : null) ??
      (typeof fromPreview === "string" && fromPreview.trim() ? fromPreview : null);
    return { ...assignment, storagePath: resolved };
  });
}

function isStudentFirst(input: ReturnType<typeof getPreviewInput>): boolean {
  return (
    input.gradingMode === "student_first" &&
    Array.isArray(input.studentPageAssignments) &&
    input.studentPageAssignments.length > 0
  );
}

export async function processStackPreviewJob(data: GradeStackQueueJobData) {
  const row = await findJobById(data.jobId);
  if (!row) {
    throw new Error(`Grading job not found: ${data.jobId}`);
  }

  await incrementAttemptCount(data.jobId);
  await updateJobStatus(data.jobId, "processing");

  try {
    const input = getPreviewInput(row);
    const images = await loadPreviewImagesFromStorage(input);
    const storagePaths = input.storagePaths.map((path) => path as string | null);
    const studentFirst = isStudentFirst(input);
    const parsePreset = coerceParsePreset(input.parsePreset, "grade_stack");

    const ocrPages = studentFirst
      ? await extractStudentFirstPreview(images, input.studentPageAssignments!, parsePreset)
      : await extractHandwrittenStack(images, parsePreset);

    if (input.autoDiscover) {
      const classId = input.classId ?? row.classId;
      if (!classId) {
        await failJob(data.jobId, "Class is required for smart grading.");
        await notifyJobSafely(data.jobId);
        return;
      }

      const discoveryImages = studentFirst
        ? firstStudentPageIndices(input.studentPageAssignments!).map((index) => images[index])
        : images;

      const { discovery, draftTestIdToDelete } = await discoverOrCreateTestForStack({
        classId,
        teacherId: row.teacherId,
        draftTestId: row.testId,
        ocrPages,
        images: discoveryImages,
        parsePreset,
      });

      const pages = studentFirst
        ? buildStudentFirstPreviewPages({ ocrPages, storagePaths })
        : await buildStackPreviewPages({ classId, ocrPages, storagePaths });

      await completePreviewJob(
        data.jobId,
        { pages, discovery, studentPageAssignments: input.studentPageAssignments },
        { testId: discovery.testId },
      );
      if (draftTestIdToDelete) {
        await deleteDraftTestIfUnused(draftTestIdToDelete);
      }
      await notifyJobSafely(data.jobId);
      return;
    }

    if (studentFirst) {
      const pages = buildStudentFirstPreviewPages({ ocrPages, storagePaths });
      await completePreviewJob(data.jobId, {
        pages,
        studentPageAssignments: input.studentPageAssignments,
      });
      await notifyJobSafely(data.jobId);
      return;
    }

    const preview = await previewStack({
      testId: row.testId,
      images,
      storagePaths,
      teacherId: row.teacherId,
      ocrPages,
    });

    await completePreviewJob(data.jobId, {
      pages: preview.pages,
      studentPageAssignments: input.studentPageAssignments,
    });
    await notifyJobSafely(data.jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview job failed.";
    if (message === "TEST_NOT_FOUND") {
      await failJob(data.jobId, "Test not found.");
      await notifyJobSafely(data.jobId);
      return;
    }
    await failJob(data.jobId, message);
    await notifyJobSafely(data.jobId);
  }
}

export async function processStackCommitJob(data: GradeStackQueueJobData) {
  const row = await findJobById(data.jobId);
  if (!row) {
    throw new Error(`Grading job not found: ${data.jobId}`);
  }

  await incrementAttemptCount(data.jobId);
  await updateJobStatus(data.jobId, "processing");

  const input = getCommitInput(row);
  let previewPayload: GradeStackPreviewPayload | null = null;
  let previewStoragePaths: (string | null)[] = [];
  if (input.previewJobId) {
    const previewJob = await findJobById(input.previewJobId);
    previewPayload = (previewJob?.previewPayload as GradeStackPreviewPayload | null) ?? null;
    if (previewJob) {
      previewStoragePaths = getPreviewInput(previewJob).storagePaths.map((path) => path as string | null);
    }
  }
  const assignments = enrichAssignmentsWithStoragePaths(
    input.assignments,
    previewPayload,
    previewStoragePaths,
  );

  try {
    const distinctStudents = Array.from(new Set(assignments.map((page) => page.studentId)));
    await updateCommitProgress(data.jobId, {
      results: [],
      progress: {
        total: distinctStudents.length,
        completed: 0,
        currentStudentId: distinctStudents[0] ?? null,
      },
    });

    const result = await commitStack({
      testId: row.testId,
      pages: assignments,
      teacherId: row.teacherId,
      onProgress: async (payload) => {
        await updateCommitProgress(data.jobId, payload);
      },
    });
    await completeCommitJob(data.jobId, { results: result.results });
    await notifyJobSafely(data.jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Commit job failed.";
    if (message.startsWith("INVALID_STUDENT_IDS:")) {
      const stale = message.slice("INVALID_STUDENT_IDS:".length);
      await failJob(data.jobId, `One or more students are not active members of this class: ${stale}`);
      await notifyJobSafely(data.jobId);
      return;
    }
    if (message === "TEST_NOT_FOUND") {
      await failJob(data.jobId, "Test not found.");
      await notifyJobSafely(data.jobId);
      return;
    }
    throw error;
  }
}
