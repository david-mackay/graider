"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { handleJson } from "@/lib/dashboard-client";

function redirectIfSubscriptionLimit(error: unknown): boolean {
  const code = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
  if (code === "GRADE_LIMIT" || code === "CLASS_LIMIT") {
    window.location.assign("/t/billing");
    return true;
  }
  return false;
}
import { uploadPagesDirectToStorage } from "@/lib/direct-upload";
import {
  defaultPresetForSurface,
  type DocumentParsePreset,
} from "@/lib/parse-presets";
import {
  createEmptyBucket,
  mergeReadyStudentPreviews,
  pagesFingerprint,
  totalPageCount,
  MAX_PAGES_PER_STUDENT,
  type StudentBucket,
} from "@/lib/student-grade";
import {
  buildStudentGradingProgress,
  type GradingPhase,
  type StudentGradingProgress,
} from "@/lib/grading-progress";
import { resolveJobResumeTarget, testSummaryFromJob } from "@/lib/resume-grade-job";
import type {
  GradeStackJob,
  OcrAnswer,
  StackCommitResult,
  StackPreview,
  TestDetail,
  TestSummary,
} from "@/lib/types";

export type StudentGradeState =
  | "pickTest"
  | "pickStudent"
  | "capture"
  | "sessionSummary"
  | "grading"
  | "reviewing"
  | "results";

export type UseStudentGradeReturn = {
  state: StudentGradeState;
  selectedTest: TestSummary | null;
  buckets: StudentBucket[];
  activeStudent: StudentBucket | null;
  preview: StackPreview | null;
  results: StackCommitResult | null;
  pageToStudentId: Map<number, string>;
  reviewImageFiles: File[];
  gradingPhase: GradingPhase | null;
  activeJob: GradeStackJob | null;
  studentProgress: StudentGradingProgress[];
  parsePreset: DocumentParsePreset;
  errorMessage: string;
  limitCode: string | null;
  isBusy: boolean;
  sendingStudentId: string | null;
  readyCount: number;
  actions: {
    selectTest: (test: TestSummary) => void;
    selectStudent: (studentId: string, studentName: string) => void;
    setActivePages: (pages: File[]) => void;
    finishActiveStudent: () => void;
    removeBucket: (studentId: string) => void;
    resumeStudent: (studentId: string) => void;
    startAddStudent: () => void;
    setParsePreset: (preset: DocumentParsePreset, studentId?: string) => void;
    setOcrAnswers: (pageIndex: number, answers: OcrAnswer[]) => void;
    sendStudent: (studentId: string) => Promise<void>;
    cancelSend: (studentId: string) => Promise<void>;
    openReview: () => void;
    confirmAll: () => Promise<void>;
    resumeFromJob: (jobId: string) => Promise<void>;
    back: () => void;
    restart: () => void;
    clearError: () => void;
  };
};

async function fetchJob(jobId: string, signal?: AbortSignal): Promise<GradeStackJob> {
  return handleJson<GradeStackJob>(
    await fetch(`/api/grade-stack/jobs/${jobId}`, { cache: "no-store", signal }),
  );
}

async function fetchTestSummary(testId: string): Promise<TestSummary> {
  const detail = await handleJson<{ test: TestDetail }>(
    await fetch(`/api/tests/${testId}`, { cache: "no-store" }),
  );
  const test = detail.test;
  return {
    id: test.id,
    title: test.title,
    class_id: test.class_id,
    teacher_id: test.teacher_id,
    status: test.status,
    opens_at: test.opens_at,
    closes_at: test.closes_at,
    duration_minutes: test.duration_minutes,
    allow_late_submit: test.allow_late_submit,
    grades_released: false,
    show_ai_feedback: false,
  };
}

async function pollJobUntilTerminal(
  jobId: string,
  options: {
    onUpdate?: (job: GradeStackJob) => void;
    signal?: AbortSignal;
  } = {},
): Promise<GradeStackJob> {
  const maxAttempts = 120;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const job = await fetchJob(jobId, options.signal);
    options.onUpdate?.(job);
    if (
      job.status === "needs_review" ||
      job.status === "completed" ||
      job.status === "failed" ||
      job.status === "cancelled"
    ) {
      return job;
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 2000);
      options.signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
  }
  throw new Error("Timed out waiting for grading job.");
}

function patchBucket(
  buckets: StudentBucket[],
  studentId: string,
  patch: Partial<StudentBucket>,
): StudentBucket[] {
  return buckets.map((bucket) =>
    bucket.studentId === studentId ? { ...bucket, ...patch } : bucket,
  );
}

export function useStudentGrade(): UseStudentGradeReturn {
  const [state, setState] = useState<StudentGradeState>("pickTest");
  const [selectedTest, setSelectedTest] = useState<TestSummary | null>(null);
  const [buckets, setBuckets] = useState<StudentBucket[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [preview, setPreview] = useState<StackPreview | null>(null);
  const [results, setResults] = useState<StackCommitResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [limitCode, setLimitCode] = useState<string | null>(null);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const [pageToStudentId, setPageToStudentId] = useState<Map<number, string>>(new Map());
  const [reviewImageFiles, setReviewImageFiles] = useState<File[]>([]);
  const [gradingPhase, setGradingPhase] = useState<GradingPhase | null>(null);
  const [activeJob, setActiveJob] = useState<GradeStackJob | null>(null);
  const [parsePreset, setParsePresetState] = useState<DocumentParsePreset>(() =>
    defaultPresetForSurface("grade_stack"),
  );
  const abortByStudentRef = useRef<Map<string, AbortController>>(new Map());
  const bucketsRef = useRef(buckets);
  bucketsRef.current = buckets;

  const sendingStudentId =
    buckets.find((bucket) => bucket.sendStatus === "sending")?.studentId ?? null;
  const isBusy = state === "grading" || sendingStudentId !== null;
  const readyCount = buckets.filter((b) => b.sendStatus === "ready").length;

  const setParsePreset = useCallback((preset: DocumentParsePreset, studentId?: string) => {
    const targetId = studentId ?? activeStudentId;
    if (targetId) {
      setBuckets((prev) => patchBucket(prev, targetId, { parsePreset: preset }));
    }
    setParsePresetState(preset);
  }, [activeStudentId]);

  const sessionStudents = useMemo(() => {
    return buckets
      .filter((bucket) => bucket.pages.length > 0)
      .map((bucket) => ({
        studentId: bucket.studentId,
        studentName: bucket.studentName,
        pageCount: bucket.pages.length,
      }));
  }, [buckets]);

  const studentProgress = useMemo(
    () =>
      gradingPhase
        ? buildStudentGradingProgress(sessionStudents, activeJob, gradingPhase)
        : [],
    [sessionStudents, activeJob, gradingPhase],
  );

  const activeStudent = useMemo(() => {
    if (!activeStudentId) return null;
    return buckets.find((b) => b.studentId === activeStudentId) ?? null;
  }, [activeStudentId, buckets]);

  const rebuildMergedPreview = useCallback((nextBuckets: StudentBucket[]) => {
    const merged = mergeReadyStudentPreviews(nextBuckets);
    setPreview(merged.pages.length > 0 ? { pages: merged.pages } : null);
    setPageToStudentId(merged.pageToStudentId);
    setReviewImageFiles(merged.imageFiles);
    setPreviewJobId(merged.previewJobId);
  }, []);

  const selectTest = useCallback((test: TestSummary) => {
    for (const controller of abortByStudentRef.current.values()) controller.abort();
    abortByStudentRef.current.clear();
    setSelectedTest(test);
    setBuckets([]);
    setActiveStudentId(null);
    setPreview(null);
    setResults(null);
    setPreviewJobId(null);
    setPageToStudentId(new Map());
    setReviewImageFiles([]);
    setGradingPhase(null);
    setActiveJob(null);
    setErrorMessage("");
    setState("pickStudent");
  }, []);

  const selectStudent = useCallback((studentId: string, studentName: string) => {
    setErrorMessage("");
    setBuckets((prev) => {
      const existing = prev.find((b) => b.studentId === studentId);
      if (existing) return prev;
      return [...prev, createEmptyBucket(studentId, studentName)];
    });
    setActiveStudentId(studentId);
    setState("capture");
  }, []);

  const resumeStudent = useCallback((studentId: string) => {
    setActiveStudentId(studentId);
    setErrorMessage("");
    setState("capture");
  }, []);

  const setActivePages = useCallback(
    (pages: File[]) => {
      if (!activeStudentId) return;
      setBuckets((prev) => {
        const current = prev.find((b) => b.studentId === activeStudentId);
        if (!current) return prev;
        const changed = pagesFingerprint(pages) !== pagesFingerprint(current.pages);
        const next = patchBucket(prev, activeStudentId, {
          pages,
          ...(changed && current.sendStatus === "ready"
            ? {
                sendStatus: "idle" as const,
                sendError: null,
                previewJobId: null,
                previewPages: [],
              }
            : {}),
        });
        if (changed && current.sendStatus === "ready") {
          queueMicrotask(() => rebuildMergedPreview(next));
        }
        return next;
      });
    },
    [activeStudentId, rebuildMergedPreview],
  );

  const finishActiveStudent = useCallback(() => {
    if (!activeStudentId) return;
    const bucket = buckets.find((b) => b.studentId === activeStudentId);
    if (!bucket || bucket.pages.length === 0) {
      setErrorMessage("Add at least one page before finishing.");
      return;
    }
    setErrorMessage("");
    setActiveStudentId(null);
    setState("sessionSummary");
  }, [activeStudentId, buckets]);

  const removeBucket = useCallback(
    (studentId: string) => {
      abortByStudentRef.current.get(studentId)?.abort();
      abortByStudentRef.current.delete(studentId);
      setBuckets((prev) => {
        const next = prev.filter((b) => b.studentId !== studentId);
        queueMicrotask(() => rebuildMergedPreview(next));
        return next;
      });
    },
    [rebuildMergedPreview],
  );

  const startAddStudent = useCallback(() => {
    setActiveStudentId(null);
    setErrorMessage("");
    setState("pickStudent");
  }, []);

  const setOcrAnswers = useCallback((pageIndex: number, answers: OcrAnswer[]) => {
    setPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((page) =>
          page.pageIndex === pageIndex ? { ...page, ocrAnswers: answers } : page,
        ),
      };
    });
  }, []);

  const cancelSend = useCallback(async (studentId: string) => {
    const controller = abortByStudentRef.current.get(studentId);
    controller?.abort();
    abortByStudentRef.current.delete(studentId);

    const bucket = bucketsRef.current.find((b) => b.studentId === studentId);
    const jobId = bucket?.previewJobId;
    if (jobId) {
      try {
        await fetch(`/api/grade-stack/jobs/${jobId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel" }),
        });
      } catch {
        // Best-effort cancel; local UI still resets.
      }
    }

    setBuckets((prev) =>
      patchBucket(prev, studentId, {
        sendStatus: "idle",
        sendError: null,
        previewJobId: null,
        previewPages: [],
      }),
    );
    setActiveJob(null);
  }, []);

  const sendStudent = useCallback(
    async (studentId: string) => {
      if (!selectedTest) {
        setErrorMessage("Pick a test first.");
        return;
      }
      const bucket = bucketsRef.current.find((b) => b.studentId === studentId);
      if (!bucket || bucket.pages.length === 0) {
        setErrorMessage("Add at least one page before sending.");
        return;
      }
      if (bucket.pages.length > MAX_PAGES_PER_STUDENT) {
        setErrorMessage(`Maximum ${MAX_PAGES_PER_STUDENT} pages per student.`);
        return;
      }
      if (bucket.sendStatus === "sending") return;

      abortByStudentRef.current.get(studentId)?.abort();
      const controller = new AbortController();
      abortByStudentRef.current.set(studentId, controller);

      setErrorMessage("");
      setLimitCode(null);
      setBuckets((prev) =>
        patchBucket(prev, studentId, {
          sendStatus: "sending",
          sendError: null,
          previewJobId: null,
          previewPages: [],
        }),
      );

      try {
        const idempotencyKey = `student-first:${selectedTest.id}:${studentId}:${pagesFingerprint(bucket.pages)}`;
        const studentPageAssignments = bucket.pages.map((_, pageIndex) => ({
          pageIndex,
          studentId,
          parsePreset: bucket.parsePreset,
        }));

        let created: { jobId: string };

        try {
          const uploaded = await uploadPagesDirectToStorage({
            testId: selectedTest.id,
            classId: selectedTest.class_id,
            files: bucket.pages,
            signal: controller.signal,
          });

          created = await handleJson<{ jobId: string }>(
            await fetch("/api/grade-stack/jobs/preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                testId: selectedTest.id,
                classId: selectedTest.class_id,
                idempotencyKey,
                gradingMode: "student_first",
                parsePreset: bucket.parsePreset,
                studentPageAssignments,
                storagePaths: uploaded.storagePaths,
                imageMeta: uploaded.imageMeta,
              }),
            }),
          );
        } catch (directError) {
          const code =
            directError instanceof Error
              ? (directError as Error & { code?: string }).code
              : undefined;
          // Local / misconfigured storage: fall back to multipart through the API.
          if (code !== "OBJECT_STORAGE_UNAVAILABLE") throw directError;

          const formData = new FormData();
          formData.append("testId", selectedTest.id);
          formData.append("classId", selectedTest.class_id);
          formData.append("idempotencyKey", idempotencyKey);
          formData.append("gradingMode", "student_first");
          formData.append("parsePreset", bucket.parsePreset);
          formData.append("studentPageAssignments", JSON.stringify(studentPageAssignments));
          for (const file of bucket.pages) {
            formData.append("images", file);
          }

          created = await handleJson<{ jobId: string }>(
            await fetch("/api/grade-stack/jobs/preview", {
              method: "POST",
              body: formData,
              signal: controller.signal,
            }),
          );
        }

        setBuckets((prev) => patchBucket(prev, studentId, { previewJobId: created.jobId }));

        const job = await pollJobUntilTerminal(created.jobId, {
          signal: controller.signal,
          onUpdate: (update) => {
            if (bucketsRef.current.find((b) => b.studentId === studentId)?.sendStatus === "sending") {
              setActiveJob(update);
            }
          },
        });

        if (job.status === "failed" || job.status === "cancelled") {
          throw new Error(job.error ?? "Preview job failed.");
        }

        const pages = job.preview?.pages ?? [];
        setBuckets((prev) => {
          const next = patchBucket(prev, studentId, {
            sendStatus: "ready",
            sendError: null,
            previewJobId: created.jobId,
            previewPages: pages,
          });
          queueMicrotask(() => rebuildMergedPreview(next));
          return next;
        });
        setActiveJob(null);
        setActiveStudentId(null);
        setState("sessionSummary");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setBuckets((prev) =>
            patchBucket(prev, studentId, {
              sendStatus: "idle",
              sendError: null,
              previewJobId: null,
              previewPages: [],
            }),
          );
          setActiveJob(null);
          return;
        }
        if (redirectIfSubscriptionLimit(error)) return;
        const rawMessage = error instanceof Error ? error.message : "Failed to read pages.";
        setBuckets((prev) =>
          patchBucket(prev, studentId, {
            sendStatus: "error",
            sendError: rawMessage,
          }),
        );
        setErrorMessage(rawMessage);
        setActiveJob(null);
      } finally {
        abortByStudentRef.current.delete(studentId);
      }
    },
    [rebuildMergedPreview, selectedTest],
  );

  const openReview = useCallback(() => {
    const merged = mergeReadyStudentPreviews(bucketsRef.current);
    if (merged.pages.length === 0) {
      setErrorMessage("Send at least one student before reviewing.");
      return;
    }
    setPreview({ pages: merged.pages });
    setPageToStudentId(merged.pageToStudentId);
    setReviewImageFiles(merged.imageFiles);
    setPreviewJobId(merged.previewJobId);
    setErrorMessage("");
    setState("reviewing");
  }, []);

  const confirmAll = useCallback(async () => {
    const testId = selectedTest?.id;
    if (!testId || !preview) {
      setErrorMessage("Nothing to grade.");
      return;
    }

    setErrorMessage("");
    const payloadAssignments: {
      pageIndex: number;
      studentId: string;
      ocrAnswers: OcrAnswer[];
      storagePath?: string | null;
    }[] = [];

    for (const page of preview.pages) {
      const studentId = pageToStudentId.get(page.pageIndex);
      if (!studentId) continue;
      payloadAssignments.push({
        pageIndex: page.pageIndex,
        studentId,
        ocrAnswers: page.ocrAnswers,
        storagePath: page.storagePath ?? null,
      });
    }

    if (payloadAssignments.length === 0) {
      setErrorMessage("No pages to grade.");
      setState("reviewing");
      return;
    }

    setState("grading");
    setGradingPhase("commit");
    setActiveJob(null);

    try {
      const created = await handleJson<{ jobId: string }>(
        await fetch("/api/grade-stack/jobs/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            previewJobId,
            testId,
            assignments: payloadAssignments,
            idempotencyKey: `student-first-commit:${testId}:${payloadAssignments
              .map((e) => `${e.pageIndex}:${e.studentId}:${e.storagePath ?? ""}`)
              .join("|")}`,
          }),
        }),
      );

      const job = await pollJobUntilTerminal(created.jobId, {
        onUpdate: (update) => setActiveJob(update),
      });
      if (job.status === "failed" || job.status === "cancelled") {
        setErrorMessage(job.error ?? "Commit job failed.");
        setGradingPhase(null);
        setActiveJob(null);
        setState("reviewing");
        return;
      }

      setResults({ results: job.commit?.results ?? [] });
      setGradingPhase(null);
      setActiveJob(null);
      setState("results");
    } catch (error) {
      if (redirectIfSubscriptionLimit(error)) return;
      setErrorMessage(error instanceof Error ? error.message : "Failed to grade.");
      setGradingPhase(null);
      setActiveJob(null);
      setState("reviewing");
    }
  }, [pageToStudentId, preview, previewJobId, selectedTest]);

  const resumeFromJob = useCallback(async (jobId: string) => {
    setErrorMessage("");
    setLimitCode(null);
    setState("grading");

    try {
      let job = await fetchJob(jobId);
      setGradingPhase(job.phase === "commit" ? "commit" : "preview");
      setActiveJob(job);
      let target = resolveJobResumeTarget(job);

      if (target.kind === "wait") {
        job = await pollJobUntilTerminal(jobId, {
          onUpdate: (update) => {
            setActiveJob(update);
          },
        });
        target = resolveJobResumeTarget(job);
      }

      let test: TestSummary;
      try {
        test = await fetchTestSummary(job.testId);
      } catch {
        test = testSummaryFromJob(job, job.preview?.discovery?.testTitle ?? "Test");
      }
      setSelectedTest(test);

      if (target.kind === "failed") {
        setErrorMessage(target.message);
        setGradingPhase(null);
        setActiveJob(null);
        setState("pickTest");
        throw new Error(target.message);
      }

      if (target.kind === "review") {
        setPreviewJobId(target.previewJobId);
        setPreview({ pages: job.preview?.pages ?? [] });
        setPageToStudentId(target.pageToStudentId);
        setGradingPhase(null);
        setActiveJob(null);
        setState("reviewing");
        return;
      }

      if (target.kind === "results") {
        setResults({ results: job.commit?.results ?? [] });
        setGradingPhase(null);
        setActiveJob(null);
        setState("results");
        return;
      }

      throw new Error("This grading job is not ready to open yet.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not open grading job.");
      setGradingPhase(null);
      setActiveJob(null);
      setState("pickTest");
      throw error;
    }
  }, []);

  const back = useCallback(() => {
    setErrorMessage("");
    setState((prev) => {
      if (prev === "pickStudent") return "pickTest";
      if (prev === "capture")
        return buckets.some((b) => b.pages.length > 0) ? "sessionSummary" : "pickStudent";
      if (prev === "sessionSummary") return "pickStudent";
      if (prev === "reviewing") {
        return buckets.some((b) => b.pages.length > 0) ? "sessionSummary" : "pickTest";
      }
      if (prev === "results") return "pickTest";
      return prev;
    });
  }, [buckets]);

  const restart = useCallback(() => {
    for (const controller of abortByStudentRef.current.values()) controller.abort();
    abortByStudentRef.current.clear();
    setSelectedTest(null);
    setBuckets([]);
    setActiveStudentId(null);
    setPreview(null);
    setResults(null);
    setPreviewJobId(null);
    setPageToStudentId(new Map());
    setReviewImageFiles([]);
    setGradingPhase(null);
    setActiveJob(null);
    setParsePresetState(defaultPresetForSurface("grade_stack"));
    setErrorMessage("");
    setState("pickTest");
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage("");
    setLimitCode(null);
  }, []);

  const actions = useMemo(
    () => ({
      selectTest,
      selectStudent,
      setActivePages,
      finishActiveStudent,
      removeBucket,
      resumeStudent,
      startAddStudent,
      setParsePreset,
      setOcrAnswers,
      sendStudent,
      cancelSend,
      openReview,
      confirmAll,
      resumeFromJob,
      back,
      restart,
      clearError,
    }),
    [
      selectTest,
      selectStudent,
      setActivePages,
      finishActiveStudent,
      removeBucket,
      resumeStudent,
      startAddStudent,
      setParsePreset,
      setOcrAnswers,
      sendStudent,
      cancelSend,
      openReview,
      confirmAll,
      resumeFromJob,
      back,
      restart,
      clearError,
    ],
  );

  return {
    state,
    selectedTest,
    buckets,
    activeStudent,
    preview,
    results,
    pageToStudentId,
    reviewImageFiles,
    gradingPhase,
    activeJob,
    studentProgress,
    parsePreset,
    errorMessage,
    limitCode,
    isBusy,
    sendingStudentId,
    readyCount,
    actions,
  };
}

export { totalPageCount };
