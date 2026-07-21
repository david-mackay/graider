"use client";

import { useMemo, useState } from "react";
import { Card, btnSecondary, inputClass } from "@/components/shared/ui";
import {
  duplicateNameCounts,
  rosterDisplayLabel,
  searchAndSortRoster,
} from "@/lib/roster-display";
import type { RosterEntry } from "@/lib/types";

type StepPickStudentProps = {
  roster: RosterEntry[];
  rosterLoading: boolean;
  rosterError: string;
  sessionStudentIds: Set<string>;
  onSelect: (studentId: string, studentName: string) => void;
  onResume: (studentId: string) => void;
  onBack: () => void;
};

export default function StepPickStudent({
  roster,
  rosterLoading,
  rosterError,
  sessionStudentIds,
  onSelect,
  onResume,
  onBack,
}: StepPickStudentProps) {
  const [query, setQuery] = useState("");

  const nameCounts = useMemo(() => duplicateNameCounts(roster), [roster]);
  const results = useMemo(() => searchAndSortRoster(roster, query), [roster, query]);
  const showFiltered = query.trim().length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-display text-lg font-semibold text-ink">
          Who are you grading?
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          Search by first or last name — email shows for students with the same name.
        </p>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a name…"
          className={`${inputClass} mt-4`}
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        {!showFiltered && roster.length > 0 ? (
          <p className="mt-2 text-xs text-ink-faint">
            {roster.length} student{roster.length === 1 ? "" : "s"} — start typing to filter
          </p>
        ) : null}
      </Card>

      {rosterError ? (
        <Card className="border-pen-soft/60 bg-pen-wash">
          <p className="text-sm font-bold text-pen-deep">{rosterError}</p>
        </Card>
      ) : null}

      {rosterLoading ? (
        <Card>
          <div className="flex flex-col items-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-pen border-t-transparent" />
            <p className="mt-3 text-sm text-ink-soft">Loading roster…</p>
          </div>
        </Card>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          {results.length === 0 ? (
            <Card>
              <p className="py-6 text-center text-sm text-ink-soft">
                {roster.length === 0
                  ? "No students in this class yet."
                  : `No matches for “${query.trim()}”.`}
              </p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {results.map((entry) => {
                const inSession = sessionStudentIds.has(entry.user_id);
                const { primaryLabel, secondaryLabel } = rosterDisplayLabel(entry, nameCounts);
                return (
                  <li key={entry.user_id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (inSession) onResume(entry.user_id);
                        else onSelect(entry.user_id, primaryLabel);
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors duration-150 ${
                        inSession
                          ? "border-pen/30 bg-pen-wash/40 hover:bg-pen-wash/60"
                          : "border-line bg-paper hover:border-ink-faint hover:bg-cream"
                      }`}
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cream-deep font-display text-sm font-bold text-ink">
                        {primaryLabel.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-base font-semibold text-ink">
                          {primaryLabel}
                        </p>
                        {secondaryLabel ? (
                          <p className="truncate text-xs text-ink-faint">{secondaryLabel}</p>
                        ) : null}
                      </div>
                      {inSession ? (
                        <span className="text-xs font-bold text-pen-deep">Add pages</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="flex">
        <button type="button" onClick={onBack} className={btnSecondary}>
          Back
        </button>
      </div>
    </div>
  );
}
