"use client";

import { useEffect, useMemo, useState } from "react";
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
  const { state, selectedTest, preview, pageFiles, assignments, results, errorMessage, isBusy, actions } =
    wizard;

  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState<boolean>(false);
  const [rosterError, setRosterError] = useState<string>("");
  const [rosterClassId, setRosterClassId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  // Welcome banner after the onboarding funnel hands the teacher over.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("welcome") === "1") {
      setShowWelcome(true);
      params.delete("welcome");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }
  }, []);

  // Object URLs for the uploaded page photos, indexed by pageIndex.
  const pageImageUrls = useMemo(() => pageFiles.map((file) => URL.createObjectURL(file)), [pageFiles]);
  useEffect(() => {
    return () => {
      for (const url of pageImageUrls) URL.revokeObjectURL(url);
    };
  }, [pageImageUrls]);

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
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {showWelcome ? (
        <div className="mb-6 animate-rise rounded-2xl border border-moss/30 bg-moss-wash px-5 py-4 shadow-paper">
          <p className="font-hand text-2xl text-moss-deep">Your first paper is saved.</p>
          <p className="mt-1 text-sm text-ink-soft">
            This is where you grade whole stacks — pick a test, photograph the pile, and the red pen takes it from there.
          </p>
        </div>
      ) : null}

      <SectionHeader
        overline="The red pen"
        title="Grade a stack"
        subtitle="Upload photos of handwritten papers; we'll read each page, match it to a student, and grade in one pass."
      />

      <ol className="mb-8 flex items-center gap-2" aria-label="Wizard steps">
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
              {index < STEPS.length - 1 ? (
                <span
                  className={`h-px flex-1 ${isComplete ? "bg-moss/40" : "bg-line"}`}
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
          <Card className="flex flex-wrap items-center justify-between gap-3 bg-cream">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-faint">
                Selected test
              </p>
              <p className="mt-0.5 font-display text-base font-semibold text-ink">
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
              pages={preview.pages}
              pageImageUrls={pageImageUrls}
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
