"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, SectionHeader, btnPrimary, btnSecondary } from "@/components/shared/ui";
import { IconCheck } from "@/components/shared/icons";
import { handleJson } from "@/lib/dashboard-client";
import type { RosterEntry } from "@/lib/types";
import {
  useStudentGrade,
  type StudentGradeState,
} from "@/components/teacher/grade-wizard/use-student-grade";
import {
  useStackGrade,
  type WizardState as StackWizardState,
} from "@/components/teacher/grade-wizard/use-stack-grade";
import { formatStudentDisplayName } from "@/lib/roster-display";
import StepPickTest from "@/components/teacher/grade-wizard/StepPickTest";
import StepPickStudent from "@/components/teacher/grade-wizard/StepPickStudent";
import StepCapturePages from "@/components/teacher/grade-wizard/StepCapturePages";
import StepSessionSummary from "@/components/teacher/grade-wizard/StepSessionSummary";
import StepGradingProgress from "@/components/teacher/grade-wizard/StepGradingProgress";
import StepStudentReview from "@/components/teacher/grade-wizard/StepStudentReview";
import StepUploadStack from "@/components/teacher/grade-wizard/StepUploadStack";
import StepReviewMatches from "@/components/teacher/grade-wizard/StepReviewMatches";
import StepResults from "@/components/teacher/grade-wizard/StepResults";

type EntryMode = "student_first" | "stack";

type StudentStepDef = {
  id: 1 | 2 | 3 | 4;
  label: string;
  matches: (state: StudentGradeState) => boolean;
};

type StackStepDef = {
  id: 1 | 2 | 3 | 4;
  label: string;
  matches: (state: StackWizardState) => boolean;
};

const STUDENT_STEPS: StudentStepDef[] = [
  { id: 1, label: "Pick test", matches: (s) => s === "pickTest" },
  {
    id: 2,
    label: "Capture",
    matches: (s) => s === "pickStudent" || s === "capture" || s === "sessionSummary",
  },
  { id: 3, label: "Review", matches: (s) => s === "grading" || s === "reviewing" },
  { id: 4, label: "Results", matches: (s) => s === "results" },
];

const STACK_STEPS: StackStepDef[] = [
  { id: 1, label: "Pick test", matches: (s) => s === "pickTest" },
  { id: 2, label: "Upload", matches: (s) => s === "uploadStack" || s === "preview-loading" },
  { id: 3, label: "Review", matches: (s) => s === "reviewing" || s === "committing" },
  { id: 4, label: "Results", matches: (s) => s === "results" },
];

function studentActiveId(state: StudentGradeState): 1 | 2 | 3 | 4 {
  if (state === "pickTest") return 1;
  if (state === "pickStudent" || state === "capture" || state === "sessionSummary") return 2;
  if (state === "grading" || state === "reviewing") return 3;
  return 4;
}

function stackActiveId(state: StackWizardState): 1 | 2 | 3 | 4 {
  if (state === "pickTest") return 1;
  if (state === "uploadStack" || state === "preview-loading") return 2;
  if (state === "reviewing" || state === "committing") return 3;
  return 4;
}

export default function GradeWizard() {
  const [mode, setMode] = useState<EntryMode>("student_first");
  const studentWizard = useStudentGrade();
  const stackWizard = useStackGrade();

  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [rosterClassId, setRosterClassId] = useState<string | null>(null);
  const [rosterClassName, setRosterClassName] = useState<string | null>(null);
  const [addingStudent, setAddingStudent] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("welcome") === "1") {
      setShowWelcome(true);
      params.delete("welcome");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }
  }, []);

  const activeClassId =
    mode === "student_first"
      ? studentWizard.selectedTest?.class_id ?? null
      : stackWizard.selectedTest?.class_id ?? null;

  const loadRoster = useCallback(async (classId: string) => {
    setRosterLoading(true);
    setRosterError("");
    try {
      const [rosterPayload, classesPayload] = await Promise.all([
        handleJson<{ roster: RosterEntry[] }>(
          await fetch(`/api/classes/${classId}/roster`, { cache: "no-store" }),
        ),
        handleJson<{ classes: Array<{ id: string; name: string }> }>(
          await fetch("/api/classes", { cache: "no-store" }),
        ),
      ]);
      setRoster(rosterPayload.roster ?? []);
      setRosterClassId(classId);
      setRosterClassName(classesPayload.classes?.find((cls) => cls.id === classId)?.name ?? null);
    } catch (error) {
      setRosterError(error instanceof Error ? error.message : "Failed to load roster.");
    } finally {
      setRosterLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeClassId) {
      if (roster.length) setRoster([]);
      if (rosterClassId !== null) setRosterClassId(null);
      if (rosterClassName !== null) setRosterClassName(null);
      return;
    }
    if (rosterClassId === activeClassId) return;
    let cancelled = false;
    void loadRoster(activeClassId).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [activeClassId, loadRoster, roster.length, rosterClassId, rosterClassName]);

  const rosterNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of roster) {
      map.set(
        entry.user_id,
        formatStudentDisplayName({ fullName: entry.full_name, email: entry.email }),
      );
    }
    return map;
  }, [roster]);

  // Student-first flow bits
  const {
    state: studentState,
    selectedTest: studentTest,
    buckets,
    activeStudent,
    preview: studentPreview,
    results: studentResults,
    pageToStudentId,
    reviewImageFiles,
    gradingPhase,
    activeJob,
    studentProgress,
    errorMessage: studentError,
    isBusy: studentBusy,
    readyCount,
    actions: studentActions,
  } = studentWizard;

  // Stack flow bits
  const {
    state: stackState,
    selectedTest: stackTest,
    preview: stackPreview,
    pageFiles: stackPageFiles,
    assignments: stackAssignments,
    results: stackResults,
    errorMessage: stackError,
    isBusy: stackBusy,
    actions: stackActions,
  } = stackWizard;

  const stackPageImageUrls = useMemo(
    () => stackPageFiles.map((file) => URL.createObjectURL(file)),
    [stackPageFiles],
  );
  useEffect(() => {
    return () => {
      for (const url of stackPageImageUrls) URL.revokeObjectURL(url);
    };
  }, [stackPageImageUrls]);

  // For student-first: image URLs follow the merged ready-preview order.
  const studentPageImageUrls = useMemo(() => {
    return reviewImageFiles.map((file) => URL.createObjectURL(file));
  }, [reviewImageFiles]);
  const studentPageMimeTypes = useMemo(
    () => reviewImageFiles.map((file) => file.type || null),
    [reviewImageFiles],
  );
  useEffect(() => {
    return () => {
      for (const url of studentPageImageUrls) URL.revokeObjectURL(url);
    };
  }, [studentPageImageUrls]);

  const studentProgressWithNames = useMemo(
    () =>
      studentProgress.map((student) => ({
        ...student,
        studentName: rosterNameById.get(student.studentId) ?? student.studentName,
      })),
    [studentProgress, rosterNameById],
  );

  const sessionStudentIds = useMemo(
    () => new Set(buckets.map((b) => b.studentId)),
    [buckets],
  );

  const handleAddStudent = useCallback(
    async (fullName: string, email: string) => {
      const classId = studentTest?.class_id;
      if (!classId) {
        throw new Error("Pick a test (and class) before adding a student.");
      }
      setAddingStudent(true);
      try {
        const payload = await handleJson<{
          student: { user_id: string; full_name: string | null };
        }>(
          await fetch(`/api/classes/${classId}/students`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              full_name: fullName,
              email: email || undefined,
            }),
          }),
        );
        const name = payload.student.full_name ?? fullName;
        studentActions.selectStudent(payload.student.user_id, name);
        void loadRoster(classId);
      } finally {
        setAddingStudent(false);
      }
    },
    [loadRoster, studentActions, studentTest?.class_id],
  );

  const activeIsStudent = mode === "student_first";
  const activeSteps = activeIsStudent ? STUDENT_STEPS : STACK_STEPS;
  const activeId = activeIsStudent
    ? studentActiveId(studentState)
    : stackActiveId(stackState);

  function switchToStack() {
    studentActions.restart();
    setMode("stack");
  }

  function switchToStudentFirst() {
    stackActions.restart();
    setMode("student_first");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {showWelcome ? (
        <div className="mb-6 animate-rise rounded-2xl border border-moss/30 bg-moss-wash px-5 py-4 shadow-paper">
          <p className="font-hand text-2xl text-moss-deep">Your first paper is saved.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Pick a student, snap their pages, and the red pen takes it from there.
          </p>
        </div>
      ) : null}

      <SectionHeader
        overline="The red pen"
        title="Grade papers"
        subtitle={
          activeIsStudent
            ? "Pick a student, add their pages, and send each one — then review and grade."
            : "Upload a whole class set at once. We'll match each page to a student and grade in one pass."
        }
      />

      <ol className="mb-8 flex items-center gap-2" aria-label="Wizard steps">
        {activeSteps.map((step, index) => {
          const isActive = activeIsStudent
            ? (step as StudentStepDef).matches(studentState)
            : (step as StackStepDef).matches(stackState);
          const isComplete = step.id < activeId;
          return (
            <li
              key={step.id}
              className="flex flex-1 items-center gap-2"
              aria-current={isActive ? "step" : undefined}
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-display text-xs font-bold transition-colors duration-150 ${
                  isComplete
                    ? "bg-moss text-white"
                    : isActive
                      ? "bg-pen text-white"
                      : "bg-cream-deep text-ink-faint"
                }`}
              >
                {isComplete ? <IconCheck className="h-4 w-4" /> : step.id}
              </div>
              <span
                className={`hidden text-sm font-bold sm:inline ${
                  isActive ? "text-ink" : isComplete ? "text-moss-deep" : "text-ink-faint"
                }`}
              >
                {step.label}
              </span>
              {index < activeSteps.length - 1 ? (
                <span
                  className={`h-px flex-1 ${isComplete ? "bg-moss/40" : "bg-line"}`}
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Student-first flow */}
      {activeIsStudent ? (
        <>
          {studentState === "pickTest" ? (
            <div className="space-y-4">
              <StepPickTest
                onSelect={studentActions.selectTest}
                onResumeJob={(jobId) => void studentActions.resumeFromJob(jobId)}
              />
              <Card className="flex flex-wrap items-center justify-between gap-3 bg-cream/60">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-faint">
                    Have a pile already sorted together?
                  </p>
                  <p className="mt-0.5 text-sm text-ink">
                    Upload the class set and we&apos;ll match pages to students.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={switchToStack}
                  className={btnSecondary}
                >
                  Upload the class set instead
                </button>
              </Card>
            </div>
          ) : null}

          {studentTest && studentState !== "pickTest" && studentState !== "results" ? (
            <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-cream/60">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-faint">
                  Test
                </p>
                <p className="mt-0.5 font-display text-base font-semibold text-ink">
                  {studentTest.title}
                </p>
              </div>
              <button
                type="button"
                onClick={studentActions.restart}
                disabled={studentBusy}
                className={btnSecondary}
              >
                Change
              </button>
            </Card>
          ) : null}

          {studentState === "pickStudent" && studentTest ? (
            <StepPickStudent
              roster={roster}
              rosterLoading={rosterLoading}
              rosterError={rosterError}
              className={rosterClassName}
              sessionStudentIds={sessionStudentIds}
              onSelect={studentActions.selectStudent}
              onResume={studentActions.resumeStudent}
              onAddStudent={handleAddStudent}
              addingStudent={addingStudent}
              onBack={studentActions.back}
            />
          ) : null}

          {studentState === "capture" && activeStudent ? (
            <StepCapturePages
              studentName={activeStudent.studentName}
              initialPages={activeStudent.pages}
              pageCount={activeStudent.pages.length}
              sendStatus={activeStudent.sendStatus}
              sendError={activeStudent.sendError}
              onFilesChange={studentActions.setActivePages}
              onSend={() => void studentActions.sendStudent(activeStudent.studentId)}
              onCancelSend={() => void studentActions.cancelSend(activeStudent.studentId)}
              onSaveForLater={studentActions.finishActiveStudent}
              onBack={studentActions.back}
              errorMessage={studentError}
            />
          ) : null}

          {studentState === "sessionSummary" && studentTest ? (
            <StepSessionSummary
              buckets={buckets}
              testTitle={studentTest.title}
              onAddStudent={studentActions.startAddStudent}
              onResumeStudent={studentActions.resumeStudent}
              onRemoveStudent={studentActions.removeBucket}
              onSendStudent={(studentId) => void studentActions.sendStudent(studentId)}
              onCancelSend={(studentId) => void studentActions.cancelSend(studentId)}
              onReview={studentActions.openReview}
              onBack={studentActions.back}
              isBusy={studentBusy}
              readyCount={readyCount}
              errorMessage={studentError}
            />
          ) : null}

          {studentState === "grading" && gradingPhase && studentTest ? (
            <StepGradingProgress
              phase={gradingPhase}
              testTitle={studentTest.title}
              students={studentProgressWithNames}
              activeJob={activeJob}
              errorMessage={studentError}
            />
          ) : null}

          {studentState === "reviewing" && studentPreview && studentTest ? (
            <StepStudentReview
              pages={studentPreview.pages}
              pageToStudentId={pageToStudentId}
              pageImageUrls={studentPageImageUrls}
              pageMimeTypes={studentPageMimeTypes}
              roster={roster}
              onOcrAnswersChange={studentActions.setOcrAnswers}
              onConfirm={() => void studentActions.confirmAll()}
              onBack={studentActions.back}
              isBusy={studentBusy}
              errorMessage={studentError}
            />
          ) : null}

          {studentState === "results" && studentResults && studentTest ? (
            <StepResults
              results={studentResults}
              roster={roster}
              testTitle={studentTest.title}
              onRestart={studentActions.restart}
            />
          ) : null}
        </>
      ) : (
        <>
          {/* Stack (secondary) flow */}
          {stackState === "pickTest" ? (
            <div className="space-y-4">
              <Card className="flex flex-wrap items-center justify-between gap-3 bg-cream/60">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-faint">
                    Class set
                  </p>
                  <p className="mt-0.5 text-sm text-ink">
                    Upload every page in one batch and we&apos;ll match names to students.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={switchToStudentFirst}
                  className={btnPrimary}
                >
                  Grade student-by-student instead
                </button>
              </Card>
              <StepPickTest
                onSelect={stackActions.selectTest}
                onResumeJob={(jobId) => {
                  switchToStudentFirst();
                  void studentActions.resumeFromJob(jobId);
                }}
              />
            </div>
          ) : null}

          {(stackState === "uploadStack" || stackState === "preview-loading") && stackTest ? (
            <div className="space-y-3">
              <Card className="flex flex-wrap items-center justify-between gap-3 bg-cream">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-faint">
                    Selected test
                  </p>
                  <p className="mt-0.5 font-display text-base font-semibold text-ink">
                    {stackTest.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={stackActions.back}
                  disabled={stackBusy}
                  className={btnSecondary}
                >
                  Change test
                </button>
              </Card>
              <StepUploadStack
                selectedTest={stackTest}
                onSubmit={stackActions.submitImages}
                onBack={stackActions.back}
                isBusy={stackBusy}
                errorMessage={stackError}
                onClearError={stackActions.clearError}
              />
            </div>
          ) : null}

          {(stackState === "reviewing" || stackState === "committing") && stackPreview && stackTest ? (
            <div className="space-y-3">
              {rosterError ? (
                <Card className="border-pen-soft/60 bg-pen-wash">
                  <p className="text-sm font-bold text-pen-deep">{rosterError}</p>
                </Card>
              ) : null}
              {rosterLoading ? (
                <Card>
                  <div className="flex items-center justify-center py-6">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-pen border-t-transparent" />
                  </div>
                </Card>
              ) : (
                <StepReviewMatches
                  pages={stackPreview.pages}
                  pageImageUrls={stackPageImageUrls}
                  roster={roster}
                  assignments={stackAssignments}
                  onAssignmentChange={stackActions.setAssignment}
                  onOcrAnswersChange={stackActions.setOcrAnswers}
                  onConfirm={stackActions.confirmAll}
                  onBack={stackActions.back}
                  isBusy={stackBusy}
                  errorMessage={stackError}
                />
              )}
            </div>
          ) : null}

          {stackState === "results" && stackResults && stackTest ? (
            <StepResults
              results={stackResults}
              roster={roster}
              testTitle={stackTest.title}
              onRestart={stackActions.restart}
            />
          ) : null}
        </>
      )}
    </main>
  );
}
