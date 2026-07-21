"use client";

import { useCallback, useMemo, useState } from "react";
import { handleJson } from "@/lib/dashboard-client";
import {
  defaultPresetForSurface,
  type DocumentParsePreset,
} from "@/lib/parse-presets";
import {
  flattenStudentBuckets,
  totalPageCount,
  MAX_TOTAL_PAGES,
  type StudentBucket,
} from "@/lib/student-grade";
import {
  buildStudentGradingProgress,
  type GradingPhase,
  type StudentGradingProgress,
} from "@/lib/grading-progress";
import type {
  GradeStackJob,
  OcrAnswer,
  StackCommitResult,
  StackPreview,
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
  gradingPhase: GradingPhase | null;
  activeJob: GradeStackJob | null;
  studentProgress: StudentGradingProgress[];
  parsePreset: DocumentParsePreset;
  errorMessage: string;
  limitCode: string | null;
  isBusy: boolean;
  actions: {
    selectTest: (test: TestSummary) => void;
    selectStudent: (studentId: string, studentName: string) => void;
    setActivePages: (pages: File[]) => void;
    finishActiveStudent: () => void;
    removeBucket: (studentId: string) => void;
    resumeStudent: (studentId: string) => void;
    startAddStudent: () => void;
    setParsePreset: (preset: DocumentParsePreset) => void;
    /** Replace the ocrAnswers for a specific page in the preview. */
    setOcrAnswers: (pageIndex: number, answers: OcrAnswer[]) => void;
    submitSession: () => Promise<void>;
    confirmAll: () => Promise<void>;
    back: () => void;
    restart: () => void;
    clearError: () => void;
  };
};

async function fetchJob(jobId: string): Promise<GradeStackJob> {
  return handleJson<GradeStackJob>(
    await fetch(`/api/grade-stack/jobs/${jobId}`, { cache: "no-store" }),
  );
}

async function pollJobUntilTerminal(
  jobId: string,
  onUpdate?: (job: GradeStackJob) => void,
): Promise<GradeStackJob> {
  const maxAttempts = 120;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const job = await fetchJob(jobId);
    onUpdate?.(job);
    if (
      job.status === "needs_review" ||
      job.status === "completed" ||
      job.status === "failed" ||
      job.status === "cancelled"
    ) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Timed out waiting for grading job.");
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
  const [gradingPhase, setGradingPhase] = useState<GradingPhase | null>(null);
  const [activeJob, setActiveJob] = useState<GradeStackJob | null>(null);
  const [parsePreset, setParsePresetState] = useState<DocumentParsePreset>(() =>
    defaultPresetForSurface("grade_stack"),
  );

  const isBusy = state === "grading";

  const setParsePreset = useCallback((preset: DocumentParsePreset) => {
    setParsePresetState(preset);
  }, []);

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

  const selectTest = useCallback((test: TestSummary) => {
    setSelectedTest(test);
    setBuckets([]);
    setActiveStudentId(null);
    setPreview(null);
    setResults(null);
    setPreviewJobId(null);
    setPageToStudentId(new Map());
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
      return [...prev, { studentId, studentName, pages: [] }];
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
      setBuckets((prev) =>
        prev.map((bucket) =>
          bucket.studentId === activeStudentId ? { ...bucket, pages } : bucket,
        ),
      );
    },
    [activeStudentId],
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

  const removeBucket = useCallback((studentId: string) => {
    setBuckets((prev) => prev.filter((b) => b.studentId !== studentId));
  }, []);

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

  const submitSession = useCallback(async () => {
    if (!selectedTest) {
      setErrorMessage("Pick a test first.");
      return;
    }
    const nonEmpty = buckets.filter((b) => b.pages.length > 0);
    if (nonEmpty.length === 0) {
      setErrorMessage("Add at least one student with pages.");
      return;
    }
    if (totalPageCount(nonEmpty) > MAX_TOTAL_PAGES) {
      setErrorMessage(`Maximum ${MAX_TOTAL_PAGES} pages per grading session.`);
      return;
    }

    setErrorMessage("");
    setLimitCode(null);
    setGradingPhase("preview");
    setActiveJob(null);
    setState("grading");

    const { files, pageToStudentId: mapping } = flattenStudentBuckets(nonEmpty);
    setPageToStudentId(mapping);

    try {
      const formData = new FormData();
      const idempotencyKey = `student-first:${selectedTest.id}:${files
        .map((f) => `${f.name}:${f.size}:${f.lastModified}`)
        .join("|")}`;

      formData.append("testId", selectedTest.id);
      formData.append("classId", selectedTest.class_id);
      formData.append("idempotencyKey", idempotencyKey);
      formData.append("gradingMode", "student_first");
      formData.append("parsePreset", parsePreset);
      formData.append(
        "studentPageAssignments",
        JSON.stringify(
          Array.from(mapping.entries()).map(([pageIndex, studentId]) => ({
            pageIndex,
            studentId,
          })),
        ),
      );
      for (const file of files) {
        formData.append("images", file);
      }

      const created = await handleJson<{ jobId: string }>(
        await fetch("/api/grade-stack/jobs/preview", {
          method: "POST",
          body: formData,
        }),
      );
      setPreviewJobId(created.jobId);

      const job = await pollJobUntilTerminal(created.jobId, (update) => {
        setActiveJob(update);
      });
      if (job.status === "failed" || job.status === "cancelled") {
        throw new Error(job.error ?? "Preview job failed.");
      }

      setPreview({ pages: job.preview?.pages ?? [] });
      setGradingPhase(null);
      setActiveJob(null);
      setState("reviewing");
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Failed to read pages.";
      setErrorMessage(rawMessage);
      setGradingPhase(null);
      setActiveJob(null);
      setState("sessionSummary");
    }
  }, [buckets, selectedTest, parsePreset]);

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
            idempotencyKey: `student-first-commit:${previewJobId}:${testId}:${payloadAssignments
              .map((e) => `${e.pageIndex}:${e.studentId}`)
              .join("|")}`,
          }),
        }),
      );

      const job = await pollJobUntilTerminal(created.jobId, (update) => {
        setActiveJob(update);
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
      setErrorMessage(error instanceof Error ? error.message : "Failed to grade.");
      setGradingPhase(null);
      setActiveJob(null);
      setState("reviewing");
    }
  }, [pageToStudentId, preview, previewJobId, selectedTest]);

  const back = useCallback(() => {
    setErrorMessage("");
    setState((prev) => {
      if (prev === "pickStudent") return "pickTest";
      if (prev === "capture") return buckets.some((b) => b.pages.length > 0) ? "sessionSummary" : "pickStudent";
      if (prev === "sessionSummary") return "pickStudent";
      if (prev === "reviewing") {
        return buckets.some((b) => b.pages.length > 0) ? "sessionSummary" : "pickTest";
      }
      if (prev === "results") return "pickTest";
      return prev;
    });
  }, [buckets]);

  const restart = useCallback(() => {
    setSelectedTest(null);
    setBuckets([]);
    setActiveStudentId(null);
    setPreview(null);
    setResults(null);
    setPreviewJobId(null);
    setPageToStudentId(new Map());
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
      submitSession,
      confirmAll,
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
      submitSession,
      confirmAll,
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
    gradingPhase,
    activeJob,
    studentProgress,
    parsePreset,
    errorMessage,
    limitCode,
    isBusy,
    actions,
  };
}

export { totalPageCount };
