"use client";

import { useEffect, useState } from "react";
import { Card, SectionHeader, btnSecondary } from "@/components/shared/ui";
import { IconCheck } from "@/components/shared/icons";
import { handleJson } from "@/lib/dashboard-client";
import type { RosterEntry } from "@/lib/types";
import { useStackGrade, type WizardState } from "@/components/teacher/grade-wizard/use-stack-grade";
import StepPickTest from "@/components/teacher/grade-wizard/StepPickTest";
import StepUploadStack from "@/components/teacher/grade-wizard/StepUploadStack";
import StepReviewMatches from "@/components/teacher/grade-wizard/StepReviewMatches";
import StepResults from "@/components/teacher/grade-wizard/StepResults";

type StepDef = {
  id: 1 | 2 | 3 | 4;
  label: string;
  matches: (state: WizardState) => boolean;
};

const STEPS: StepDef[] = [
  { id: 1, label: "Pick test", matches: (s) => s === "pickTest" },
  { id: 2, label: "Upload", matches: (s) => s === "uploadStack" || s === "preview-loading" },
  { id: 3, label: "Review", matches: (s) => s === "reviewing" || s === "committing" },
  { id: 4, label: "Results", matches: (s) => s === "results" },
];

function activeStepId(state: WizardState): StepDef["id"] {
  if (state === "pickTest") return 1;
  if (state === "uploadStack" || state === "preview-loading") return 2;
  if (state === "reviewing" || state === "committing") return 3;
  return 4;
}

export default function GradeWizard() {
  const wizard = useStackGrade();
  const { state, selectedTest, preview, assignments, results, errorMessage, isBusy, actions } =
    wizard;

  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState<boolean>(false);
  const [rosterError, setRosterError] = useState<string>("");
  const [rosterClassId, setRosterClassId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTest) {
      setRoster([]);
      setRosterClassId(null);
      return;
    }
    if (rosterClassId === selectedTest.class_id) return;

    let cancelled = false;
    async function load(classId: string) {
      setRosterLoading(true);
      setRosterError("");
      try {
        const payload = await handleJson<{ roster: RosterEntry[] }>(
          await fetch(`/api/classes/${classId}/roster`, { cache: "no-store" }),
        );
        if (cancelled) return;
        setRoster(payload.roster ?? []);
        setRosterClassId(classId);
      } catch (error) {
        if (cancelled) return;
        setRosterError(error instanceof Error ? error.message : "Failed to load roster.");
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    }
    void load(selectedTest.class_id);
    return () => {
      cancelled = true;
    };
  }, [selectedTest, rosterClassId]);

  const activeId = activeStepId(state);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <SectionHeader
        title="Grade a stack"
        subtitle="Upload photos of handwritten papers; we&rsquo;ll OCR, match each page to a student, and grade in one pass."
      />

      <ol className="mb-6 flex items-center gap-2" aria-label="Wizard steps">
        {STEPS.map((step, index) => {
          const isActive = step.matches(state);
          const isComplete = step.id < activeId;
          return (
            <li
              key={step.id}
              className="flex flex-1 items-center gap-2"
              aria-current={isActive ? "step" : undefined}
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-150 ${
                  isComplete
                    ? "bg-emerald-600 text-white"
                    : isActive
                      ? "bg-indigo-600 text-white"
                      : "bg-indigo-50 text-indigo-400"
                }`}
              >
                {isComplete ? <IconCheck className="h-4 w-4" /> : step.id}
              </div>
              <span
                className={`hidden text-sm font-medium sm:inline ${
                  isActive ? "text-indigo-950" : isComplete ? "text-emerald-700" : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
              {index < STEPS.length - 1 ? (
                <span
                  className={`h-px flex-1 ${isComplete ? "bg-emerald-300" : "bg-indigo-100"}`}
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {state === "pickTest" ? <StepPickTest onSelect={actions.selectTest} /> : null}

      {(state === "uploadStack" || state === "preview-loading") && selectedTest ? (
        <div className="space-y-3">
          <Card className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/40">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
                Selected test
              </p>
              <p className="mt-0.5 text-sm font-semibold text-indigo-950">
                {selectedTest.title}
              </p>
            </div>
            <button
              type="button"
              onClick={actions.back}
              disabled={isBusy}
              className={btnSecondary}
            >
              Change test
            </button>
          </Card>
          <StepUploadStack
            selectedTest={selectedTest}
            onSubmit={actions.submitImages}
            onBack={actions.back}
            isBusy={isBusy}
            errorMessage={errorMessage}
            onClearError={actions.clearError}
          />
        </div>
      ) : null}

      {(state === "reviewing" || state === "committing") && preview && selectedTest ? (
        <div className="space-y-3">
          {rosterError ? (
            <Card className="border-red-200 bg-red-50">
              <p className="text-sm font-medium text-red-700">{rosterError}</p>
            </Card>
          ) : null}
          {rosterLoading ? (
            <Card>
              <div className="flex items-center justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
              </div>
            </Card>
          ) : (
            <StepReviewMatches
              pages={preview.pages}
              roster={roster}
              assignments={assignments}
              onAssignmentChange={actions.setAssignment}
              onConfirm={actions.confirmAll}
              onBack={actions.back}
              isBusy={isBusy}
              errorMessage={errorMessage}
            />
          )}
        </div>
      ) : null}

      {state === "results" && results && selectedTest ? (
        <StepResults
          results={results}
          roster={roster}
          testTitle={selectedTest.title}
          onRestart={actions.restart}
        />
      ) : null}
    </main>
  );
}
