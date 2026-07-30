"use client";

/**
 * Slide-in panel showing a single student's graded attempts,
 * grouped by test. Each attempt expands into AttemptGradeEditor.
 */

import { useEffect, useState } from "react";
import { Badge, Card, btnSecondary, btnPrimary } from "@/components/shared/ui";
import { IconChevronDown, IconChevronRight } from "@/components/shared/icons";
import AttemptGradeEditor from "@/components/teacher/AttemptGradeEditor";
import { handleJson } from "@/lib/dashboard-client";
import type { ClassMember, DashboardAttempt, GradedAttemptDetail } from "@/lib/dashboard-types";

type StudentProfilePanelProps = {
  student: ClassMember;
  attempts: DashboardAttempt[];
  onClose: () => void;
  onChanged?: () => void | Promise<void>;
};

type TestGroup = {
  testId: string;
  testTitle: string;
  attempts: DashboardAttempt[];
};

function groupByTest(attempts: DashboardAttempt[]): TestGroup[] {
  const map = new Map<string, TestGroup>();
  for (const a of attempts) {
    const existing = map.get(a.test_id) ?? { testId: a.test_id, testTitle: a.test_title, attempts: [] };
    existing.attempts.push(a);
    map.set(a.test_id, existing);
  }
  return Array.from(map.values());
}

export default function StudentProfilePanel({
  student,
  attempts,
  onClose,
  onChanged,
}: StudentProfilePanelProps) {
  const [groups, setGroups] = useState<TestGroup[]>([]);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [editingAttempt, setEditingAttempt] = useState<GradedAttemptDetail | null>(null);
  const [loadingAttemptId, setLoadingAttemptId] = useState<string | null>(null);

  useEffect(() => {
    const studentAttempts = attempts.filter((a) => a.student_id === student.user_id);
    setGroups(groupByTest(studentAttempts));
  }, [student.user_id, attempts]);

  const name = student.full_name?.trim() || student.email || "Student";

  async function openEditor(attemptId: string) {
    setLoadingAttemptId(attemptId);
    try {
      const data = await handleJson<{ attempt: GradedAttemptDetail }>(
        await fetch(`/api/submissions/${attemptId}`, { cache: "no-store" }),
      );
      setEditingAttempt(data.attempt);
    } finally {
      setLoadingAttemptId(null);
    }
  }

  function handleSaved(totalMarks: number, maxMarks: number) {
    // Optimistically update the displayed totals in the group list
    if (editingAttempt) {
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          attempts: g.attempts.map((a) =>
            a.id === editingAttempt.id
              ? { ...a, total_marks: totalMarks, max_marks: maxMarks, status: "graded" as const }
              : a,
          ),
        })),
      );
    }
    void onChanged?.();
  }

  if (editingAttempt) {
    return (
      <div className="space-y-4 animate-rise">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-pointer text-xs font-semibold text-pen hover:text-pen-deep transition-colors"
            onClick={() => setEditingAttempt(null)}
          >
            ← Back to {name}
          </button>
        </div>
        <AttemptGradeEditor
          attempt={editingAttempt}
          onClose={() => setEditingAttempt(null)}
          onSaved={handleSaved}
        />
      </div>
    );
  }

  return (
    <Card className="space-y-4 animate-rise">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-pen text-base font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">{name}</h3>
            {student.email && student.full_name ? (
              <p className="text-xs text-ink-faint">{student.email}</p>
            ) : null}
          </div>
        </div>
        <button type="button" className={btnSecondary} onClick={onClose}>
          Close
        </button>
      </div>

      {/* Attempts grouped by test */}
      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-soft">No submissions yet.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isOpen = expandedTestId === group.testId;
            return (
              <div key={group.testId} className="rounded-xl border border-line overflow-hidden">
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left hover:bg-cream transition-colors duration-150"
                  onClick={() => setExpandedTestId(isOpen ? null : group.testId)}
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-sm font-semibold text-ink">{group.testTitle}</span>
                  <span className="flex flex-shrink-0 items-center gap-2">
                    <span className="text-xs text-ink-faint">
                      {group.attempts.length} attempt{group.attempts.length !== 1 ? "s" : ""}
                    </span>
                    {isOpen ? (
                      <IconChevronDown className="h-4 w-4 text-ink-faint" />
                    ) : (
                      <IconChevronRight className="h-4 w-4 text-ink-faint" />
                    )}
                  </span>
                </button>

                {isOpen ? (
                  <div className="divide-y divide-line-soft border-t border-line-soft">
                    {group.attempts.map((attempt) => {
                      const ratio =
                        attempt.max_marks && attempt.max_marks > 0
                          ? (attempt.total_marks ?? 0) / attempt.max_marks
                          : null;
                      const scoreColour =
                        ratio === null
                          ? "text-ink-soft"
                          : ratio >= 0.8
                            ? "text-moss-deep"
                            : ratio >= 0.5
                              ? "text-ink"
                              : "text-pen";

                      return (
                        <div
                          key={attempt.id}
                          className="flex flex-wrap items-center justify-between gap-3 bg-cream/40 px-4 py-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  attempt.status === "graded"
                                    ? "green"
                                    : attempt.status === "submitted"
                                      ? "blue"
                                      : "gray"
                                }
                              >
                                {attempt.status}
                              </Badge>
                              {attempt.status === "graded" && attempt.max_marks ? (
                                <span className={`font-hand -rotate-2 text-2xl font-bold ${scoreColour}`}>
                                  {attempt.total_marks}/{attempt.max_marks}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {attempt.status === "graded" ? (
                            <button
                              type="button"
                              className={btnPrimary}
                              disabled={loadingAttemptId === attempt.id}
                              onClick={() => void openEditor(attempt.id)}
                            >
                              {loadingAttemptId === attempt.id ? "Loading…" : "Edit grades"}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
