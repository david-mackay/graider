"use client";

import { useCallback, useMemo, useState } from "react";
import { handleJson } from "@/lib/dashboard-client";
import type {
  OcrAnswer,
  StackCommitResult,
  StackPreview,
  TestSummary,
} from "@/lib/types";

export type WizardState =
  | "pickTest"
  | "uploadStack"
  | "preview-loading"
  | "reviewing"
  | "committing"
  | "results";

export const SKIP_VALUE = "__skip__";
export type AssignmentValue = string | typeof SKIP_VALUE;

export type AssignmentMap = Record<number, AssignmentValue>;

export type UseStackGradeReturn = {
  state: WizardState;
  selectedTest: TestSummary | null;
  preview: StackPreview | null;
  /** The uploaded page photos, in pageIndex order. */
  pageFiles: File[];
  assignments: AssignmentMap;
  results: StackCommitResult | null;
  errorMessage: string;
  isBusy: boolean;
  actions: {
    selectTest: (test: TestSummary) => void;
    submitImages: (files: File[], parsePreset?: string) => Promise<void>;
    setAssignment: (pageIndex: number, value: AssignmentValue) => void;
    setOcrAnswers: (pageIndex: number, answers: OcrAnswer[]) => void;
    confirmAll: () => Promise<void>;
    back: () => void;
    restart: () => void;
    clearError: () => void;
  };
};

function buildInitialAssignments(preview: StackPreview): AssignmentMap {
  const map: AssignmentMap = {};
  for (const page of preview.pages) {
    if (page.status === "exact" && page.suggestedStudentId) {
      map[page.pageIndex] = page.suggestedStudentId;
    } else if (page.status === "fuzzy" && page.candidates.length > 0) {
      map[page.pageIndex] = page.candidates[0];
    } else {
      map[page.pageIndex] = "";
    }
  }
  return map;
}

export function useStackGrade(): UseStackGradeReturn {
  const [state, setState] = useState<WizardState>("pickTest");
  const [selectedTest, setSelectedTest] = useState<TestSummary | null>(null);
  const [preview, setPreview] = useState<StackPreview | null>(null);
  const [pageFiles, setPageFiles] = useState<File[]>([]);
  const [assignments, setAssignments] = useState<AssignmentMap>({});
  const [results, setResults] = useState<StackCommitResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const isBusy = state === "preview-loading" || state === "committing";

  const selectTest = useCallback((test: TestSummary) => {
    setSelectedTest(test);
    setPreview(null);
    setPageFiles([]);
    setAssignments({});
    setResults(null);
    setErrorMessage("");
    setState("uploadStack");
  }, []);

  const submitImages = useCallback(
    async (files: File[], parsePreset?: string) => {
      if (!selectedTest) {
        setErrorMessage("Pick a test first.");
        return;
      }
      if (files.length === 0) {
        setErrorMessage("Please add at least one image.");
        return;
      }
      setErrorMessage("");
      setState("preview-loading");

      try {
        const formData = new FormData();
        formData.append("testId", selectedTest.id);
        if (parsePreset) formData.append("parsePreset", parsePreset);
        for (const file of files) {
          formData.append("images", file);
        }

        const payload = await handleJson<{ phase: "preview"; pages: StackPreview["pages"] }>(
          await fetch("/api/grade/stack", {
            method: "POST",
            body: formData,
          }),
        );

        const nextPreview: StackPreview = { pages: payload.pages };
        setPreview(nextPreview);
        setPageFiles(files);
        setAssignments(buildInitialAssignments(nextPreview));
        setState("reviewing");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to preview these papers.";
        setErrorMessage(message);
        setState("uploadStack");
      }
    },
    [selectedTest],
  );

  const setAssignment = useCallback((pageIndex: number, value: AssignmentValue) => {
    setAssignments((prev) => ({ ...prev, [pageIndex]: value }));
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

  const confirmAll = useCallback(async () => {
    if (!selectedTest || !preview) {
      setErrorMessage("Nothing to grade.");
      return;
    }
    setErrorMessage("");
    setState("committing");

    try {
      const payloadAssignments: {
        pageIndex: number;
        studentId: string;
        ocrAnswers: OcrAnswer[];
      }[] = [];

      for (const page of preview.pages) {
        const value = assignments[page.pageIndex];
        if (!value || value === SKIP_VALUE) continue;
        payloadAssignments.push({
          pageIndex: page.pageIndex,
          studentId: value,
          ocrAnswers: page.ocrAnswers,
        });
      }

      if (payloadAssignments.length === 0) {
        setErrorMessage("Assign at least one page before grading.");
        setState("reviewing");
        return;
      }

      const formData = new FormData();
      formData.append("testId", selectedTest.id);
      formData.append("assignments", JSON.stringify(payloadAssignments));

      const payload = await handleJson<{ phase: "commit"; results: StackCommitResult["results"] }>(
        await fetch("/api/grade/stack", {
          method: "POST",
          body: formData,
        }),
      );

      setResults({ results: payload.results });
      setState("results");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to grade these papers.";
      setErrorMessage(message);
      setState("reviewing");
    }
  }, [assignments, preview, selectedTest]);

  const back = useCallback(() => {
    setErrorMessage("");
    setState((prev) => {
      if (prev === "uploadStack") return "pickTest";
      if (prev === "reviewing") return "uploadStack";
      if (prev === "results") return "pickTest";
      return prev;
    });
  }, []);

  const restart = useCallback(() => {
    setSelectedTest(null);
    setPreview(null);
    setPageFiles([]);
    setAssignments({});
    setResults(null);
    setErrorMessage("");
    setState("pickTest");
  }, []);

  const clearError = useCallback(() => setErrorMessage(""), []);

  const actions = useMemo(
    () => ({
      selectTest,
      submitImages,
      setAssignment,
      setOcrAnswers,
      confirmAll,
      back,
      restart,
      clearError,
    }),
    [
      selectTest,
      submitImages,
      setAssignment,
      setOcrAnswers,
      confirmAll,
      back,
      restart,
      clearError,
    ],
  );

  return {
    state,
    selectedTest,
    preview,
    pageFiles,
    assignments,
    results,
    errorMessage,
    isBusy,
    actions,
  };
}
