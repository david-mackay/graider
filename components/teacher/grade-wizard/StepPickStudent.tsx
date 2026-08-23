"use client";

import { useMemo, useState } from "react";
import { Card, FormField, btnPrimary, btnSecondary, inputClass } from "@/components/shared/ui";
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
  className: string | null;
  sessionStudentIds: Set<string>;
  onSelect: (studentId: string, studentName: string) => void;
  onResume: (studentId: string) => void;
  onAddStudent: (fullName: string, email: string) => Promise<void>;
  addingStudent: boolean;
  onBack: () => void;
};

export default function StepPickStudent({
  roster,
  rosterLoading,
  rosterError,
  className,
  sessionStudentIds,
  onSelect,
  onResume,
  onAddStudent,
  addingStudent,
  onBack,
}: StepPickStudentProps) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [addError, setAddError] = useState("");

  const nameCounts = useMemo(() => duplicateNameCounts(roster), [roster]);
  const results = useMemo(() => searchAndSortRoster(roster, query), [roster, query]);
  const typedName = query.trim();
  const noMatches = !rosterLoading && results.length === 0;

  function openAdd(prefill = "") {
    setAddError("");
    setNewName(prefill);
    setNewEmail("");
    setAdding(true);
  }

  async function saveNewStudent(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) {
      setAddError("Enter a student name.");
      return;
    }
    setAddError("");
    try {
      await onAddStudent(newName.trim(), newEmail.trim());
      setAdding(false);
      setNewName("");
      setNewEmail("");
      setQuery("");
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Failed to add student.");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold text-ink">Who are you grading?</h3>
            <p className="mt-1 text-sm text-ink-soft">
              {className
                ? `Search ${className}, or add someone new to this class.`
                : "Search the roster, or add a new student."}
            </p>
          </div>
          <button type="button" onClick={() => openAdd(typedName)} className={btnPrimary}>
            + New
          </button>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a name…"
          className={`${inputClass} mt-4`}
          autoComplete="off"
          spellCheck={false}
        />
        {roster.length > 0 && typedName.length === 0 ? (
          <p className="mt-2 text-xs text-ink-faint">
            {roster.length} student{roster.length === 1 ? "" : "s"} — start typing to filter
          </p>
        ) : null}
      </Card>

      {adding ? (
        <Card>
          <form onSubmit={(event) => void saveNewStudent(event)} className="space-y-4">
            <h4 className="font-display text-base font-semibold text-ink">Add student</h4>
            <p className="text-sm text-ink-soft">
              {className
                ? `Creates them in ${className} and starts capture.`
                : "Creates them in this class and starts capture."}
            </p>
            {addError ? <p className="text-sm font-bold text-pen-deep">{addError}</p> : null}
            <FormField label="Name">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Jamie Chen"
                className={inputClass}
                autoFocus
              />
            </FormField>
            <FormField label="Email (optional)">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="jamie@school.edu"
                className={inputClass}
              />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!newName.trim() || addingStudent}
                className={btnPrimary}
              >
                {addingStudent ? "Adding…" : "Add and capture"}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                disabled={addingStudent}
                className={btnSecondary}
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      ) : null}

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
      ) : noMatches ? (
        <Card className="py-6 text-center">
          <p className="text-sm text-ink-soft">
            {roster.length === 0
              ? className
                ? `No students in ${className} yet.`
                : "No students in this class yet."
              : `No matches for “${typedName}”.`}
          </p>
          <button type="button" onClick={() => openAdd(typedName)} className={`${btnPrimary} mt-4`}>
            {typedName ? `Add “${typedName}”` : "Add a student"}
          </button>
        </Card>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
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
            {typedName.length > 0 ? (
              <li>
                <button
                  type="button"
                  onClick={() => openAdd(typedName)}
                  className="w-full rounded-2xl border border-dashed border-pen/40 bg-pen-wash/20 px-4 py-3 text-sm font-semibold text-pen-deep"
                >
                  Not listed? Add “{typedName}”
                </button>
              </li>
            ) : null}
          </ul>
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
