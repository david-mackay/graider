"use client";

import type { RosterEntry } from "@/lib/types";
import { SKIP_VALUE, type AssignmentValue } from "@/components/teacher/grade-wizard/use-stack-grade";

type RosterPickerProps = {
  roster: RosterEntry[];
  value: AssignmentValue;
  onChange: (value: AssignmentValue) => void;
  disabled?: boolean;
  id?: string;
};

function displayName(entry: RosterEntry): string {
  if (entry.full_name && entry.full_name.trim()) return entry.full_name;
  if (entry.email) return entry.email;
  return entry.user_id.slice(0, 8);
}

export default function RosterPicker({
  roster,
  value,
  onChange,
  disabled = false,
  id,
}: RosterPickerProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as AssignmentValue)}
      disabled={disabled}
      className="w-full cursor-pointer rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-indigo-950 outline-none transition-colors duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <option value={SKIP_VALUE}>Skip this page</option>
      <option value="" disabled>
        Choose a student…
      </option>
      {roster.map((entry) => (
        <option key={entry.user_id} value={entry.user_id}>
          {displayName(entry)}
          {entry.email && entry.full_name ? ` · ${entry.email}` : ""}
        </option>
      ))}
    </select>
  );
}
