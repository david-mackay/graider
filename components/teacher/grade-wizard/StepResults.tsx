"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import ExportGradePdfButton from "@/components/shared/ExportGradePdfButton";
import AttemptGradeEditor from "@/components/teacher/AttemptGradeEditor";
import { handleJson } from "@/lib/dashboard-client";
import type { GradedAttemptDetail } from "@/lib/dashboard-types";
import type { RosterEntry, StackCommitResult } from "@/lib/types";

type StepResultsProps = {
  results: StackCommitResult;
  roster: RosterEntry[];
  testTitle: string;
  onRestart: () => void;
};

function ratioColor(ratio: number): string {
  if (ratio >= 0.8) return "text-moss-deep";
  if (ratio >= 0.5) return "text-ink";
  return "text-pen";
}

async function fetchAttempt(attemptId: string): Promise<GradedAttemptDetail> {
  const payload = await handleJson<{ attempt: GradedAttemptDetail }>(
    await fetch(`/api/submissions/${attemptId}`, { cache: "no-store" }),
  );
  return payload.attempt;
}

export default function StepResults({
  results,
  roster,
  testTitle,
  onRestart,
}: StepResultsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingByStudent, setEditingByStudent] = useState<Map<string, GradedAttemptDetail>>(new Map());
  const [loadingStudentId, setLoadingStudentId] = useState<string | null>(null);
  const [scoreOverrides, setScoreOverrides] = useState<Map<string, { total: number; max: number }>>(new Map());

  const rosterById = useMemo(() => {
    const map = new Map<string, RosterEntry>();
    for (const entry of roster) map.set(entry.user_id, entry);
    return map;
  }, [roster]);

  async function toggle(studentId: string, attemptId: string) {
    const isOpen = expanded.has(studentId);
    if (!isOpen && !editingByStudent.has(studentId)) {
      setLoadingStudentId(studentId);
      try {
        const detail = await fetchAttempt(attemptId);
        setEditingByStudent((prev) => new Map(prev).set(studentId, detail));
      } finally {
        setLoadingStudentId(null);
      }
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  const totals = results.results.reduce(
    (acc, row) => ({ marks: acc.marks + row.totalMarks, max: acc.max + row.maxMarks }),
    { marks: 0, max: 0 },
  );
  const classAverage = totals.max > 0 ? Math.round((totals.marks / totals.max) * 100) : null;

  if (results.results.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <h3 className="font-display text-lg font-semibold text-ink">Nothing graded</h3>
          <p className="text-sm text-ink-soft">
            All pages were skipped. Try again with at least one assignment.
          </p>
          <button type="button" onClick={onRestart} className={btnPrimary}>
            Grade more papers
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-rise">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-hand text-2xl text-moss-deep">These papers are marked.</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-ink">
              {results.results.length} paper{results.results.length === 1 ? "" : "s"} graded
              {classAverage != null ? ` · class average ${classAverage}%` : ""}
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              {testTitle} · attempts saved and re-grades applied.
            </p>
          </div>
          <Badge variant="green">Done</Badge>
        </div>
      </Card>

      <ul className="space-y-3">
        {results.results.map((row) => {
          const entry = rosterById.get(row.studentId);
          const name =
            entry?.full_name?.trim() ||
            entry?.email ||
            row.studentId.slice(0, 8);
          const score = scoreOverrides.get(row.studentId);
          const totalMarks = score?.total ?? row.totalMarks;
          const maxMarks = score?.max ?? row.maxMarks;
          const ratio = maxMarks > 0 ? totalMarks / maxMarks : 0;
          const isOpen = expanded.has(row.studentId);
          const editing = editingByStudent.get(row.studentId);

          return (
            <li key={row.studentId} className="rounded-2xl border border-line bg-paper p-4 shadow-paper">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cream-deep font-display text-sm font-bold text-ink">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-semibold text-ink">{name}</p>
                    {entry?.email && entry?.full_name ? (
                      <p className="truncate text-xs text-ink-faint">{entry.email}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <p className={`font-hand -rotate-2 text-3xl font-bold ${ratioColor(ratio)}`}>
                    {totalMarks}/{maxMarks}
                  </p>
                  {row.created ? (
                    <Badge variant="green">New</Badge>
                  ) : (
                    <Badge variant="blue">Updated</Badge>
                  )}
                  <ExportGradePdfButton
                    attemptId={row.attemptId}
                    studentName={name}
                    fetchAttempt={fetchAttempt}
                    label="Share PDF"
                    compact
                  />
                  <button
                    type="button"
                    onClick={() => void toggle(row.studentId, row.attemptId)}
                    className="cursor-pointer text-xs font-bold text-pen hover:text-pen-deep transition-colors duration-150"
                    aria-expanded={isOpen}
                  >
                    {loadingStudentId === row.studentId ? "Loading…" : isOpen ? "Done editing" : "Edit marks"}
                  </button>
                </div>
              </div>

              {isOpen ? (
                <div className="mt-4 border-t border-line-soft pt-3">
                  {editing ? (
                    <AttemptGradeEditor
                      attempt={editing}
                      onClose={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          next.delete(row.studentId);
                          return next;
                        })
                      }
                      onSaved={(total, max) => {
                        setScoreOverrides((prev) => new Map(prev).set(row.studentId, { total, max }));
                      }}
                    />
                  ) : (
                    <p className="text-xs italic text-ink-faint">Loading this student&apos;s paper…</p>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-ink-faint">
        You can edit any paper here — student answers, marks, and the shared answer key.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/t" className={btnSecondary}>
          Back to dashboard
        </Link>
        <button type="button" onClick={onRestart} className={btnPrimary}>
          Grade more papers
        </button>
      </div>
    </div>
  );
}
