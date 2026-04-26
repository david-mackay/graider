"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { Badge, Card, btnPrimary, btnSecondary } from "@/components/shared/ui";
import type { RosterEntry, StackCommitResult } from "@/lib/types";

type StepResultsProps = {
  results: StackCommitResult;
  roster: RosterEntry[];
  testTitle: string;
  onRestart: () => void;
};

function ratioColor(ratio: number): string {
  if (ratio >= 0.8) return "text-emerald-600";
  if (ratio >= 0.5) return "text-indigo-700";
  return "text-red-600";
}

export default function StepResults({
  results,
  roster,
  testTitle,
  onRestart,
}: StepResultsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rosterById = useMemo(() => {
    const map = new Map<string, RosterEntry>();
    for (const entry of roster) map.set(entry.user_id, entry);
    return map;
  }, [roster]);

  function toggle(studentId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  if (results.results.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <h3 className="text-base font-semibold text-indigo-950">Nothing graded</h3>
          <p className="text-sm text-slate-500">
            All pages were skipped. Try again with at least one assignment.
          </p>
          <button type="button" onClick={onRestart} className={btnPrimary}>
            Grade another stack
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-indigo-950">
              Graded {results.results.length} student
              {results.results.length === 1 ? "" : "s"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {testTitle} · attempts saved and re-grades applied.
            </p>
          </div>
          <Badge variant="green">Done</Badge>
        </div>
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-indigo-100 bg-indigo-50/40 text-left text-xs font-semibold uppercase tracking-wide text-indigo-400">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {results.results.map((row) => {
                const entry = rosterById.get(row.studentId);
                const name =
                  entry?.full_name?.trim() ||
                  entry?.email ||
                  row.studentId.slice(0, 8);
                const ratio = row.maxMarks > 0 ? row.totalMarks / row.maxMarks : 0;
                const isOpen = expanded.has(row.studentId);

                return (
                  <Fragment key={row.studentId}>
                    <tr className="border-b border-indigo-50 last:border-b-0">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-indigo-950">{name}</p>
                        {entry?.email && entry?.full_name ? (
                          <p className="text-xs text-slate-400">{entry.email}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xl font-bold ${ratioColor(ratio)}`}>
                          {row.totalMarks}
                        </span>
                        <span className="ml-1 text-sm text-slate-400">
                          / {row.maxMarks}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.created ? (
                          <Badge variant="green">New</Badge>
                        ) : (
                          <Badge variant="blue">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggle(row.studentId)}
                          className="cursor-pointer text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors duration-150"
                          aria-expanded={isOpen}
                        >
                          {isOpen ? "Hide" : "Show"} per-question
                        </button>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="border-b border-indigo-50 bg-indigo-50/30">
                        <td colSpan={4} className="px-4 py-3">
                          {row.grades.length === 0 ? (
                            <p className="text-xs italic text-slate-500">No per-question marks were recorded.</p>
                          ) : (
                            <ul className="space-y-2">
                              {row.grades.map((grade, idx) => (
                                <li
                                  key={`${grade.questionId}-${idx}`}
                                  className="rounded-lg border border-indigo-100 bg-white px-3 py-2"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
                                      Question {idx + 1}
                                    </p>
                                    <span className="text-sm font-bold text-indigo-700">
                                      {grade.marksEarned}
                                    </span>
                                  </div>
                                  {grade.feedback ? (
                                    <p className="mt-1 text-xs text-slate-600">{grade.feedback}</p>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-slate-400">
        Tip: head back to the dashboard to see these attempts in the test&apos;s submissions list.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/t" className={btnSecondary}>
          Back to dashboard
        </Link>
        <button type="button" onClick={onRestart} className={btnPrimary}>
          Grade another stack
        </button>
      </div>
    </div>
  );
}
