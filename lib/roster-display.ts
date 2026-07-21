import type { RosterEntry } from "@/lib/types";

export type RosterDisplay = {
  primaryLabel: string;
  secondaryLabel: string | null;
  searchKey: string;
};

function emailLocalPart(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

function baseName(entry: RosterEntry): string {
  if (entry.full_name?.trim()) return entry.full_name.trim();
  if (entry.email) return entry.email;
  return "Unnamed student";
}

/**
 * Human-readable student label. Never returns raw Clerk/user IDs like "Student user_…".
 */
export function formatStudentDisplayName(params: {
  fullName?: string | null;
  email?: string | null;
  studentId?: string | null;
  fallback?: string;
}): string {
  if (params.fullName?.trim()) return params.fullName.trim();
  if (params.email?.trim()) return params.email.trim();
  return params.fallback?.trim() || "Unnamed student";
}

/** Count duplicate full names in a roster for disambiguation. */
export function duplicateNameCounts(roster: RosterEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of roster) {
    const name = entry.full_name?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

/** Primary name with email-local disambiguation when names collide. */
export function rosterDisplayLabel(
  entry: RosterEntry,
  nameCounts?: Map<string, number>,
): RosterDisplay {
  const base = baseName(entry);
  const name = entry.full_name?.trim();
  const counts = nameCounts ?? duplicateNameCounts([entry]);
  const isDuplicate = name ? (counts.get(name) ?? 0) > 1 : false;
  const local = emailLocalPart(entry.email);

  let primaryLabel = base;
  if (isDuplicate && local) {
    primaryLabel = `${base} (${local})`;
  }

  const secondaryLabel = entry.email?.trim() ? entry.email.trim() : null;
  const searchKey = `${entry.full_name ?? ""} ${entry.email ?? ""} ${local}`.toLowerCase();

  return { primaryLabel, secondaryLabel, searchKey };
}

function nameParts(fullName: string): string[] {
  return fullName
    .toLowerCase()
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function queryTokens(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/** Match first name, last name, full name substring, or email. */
export function rosterEntryMatchesQuery(entry: RosterEntry, query: string): boolean {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return true;

  const fullName = entry.full_name?.toLowerCase() ?? "";
  const parts = nameParts(fullName);
  const email = entry.email?.toLowerCase() ?? "";
  const local = emailLocalPart(entry.email).toLowerCase();

  return tokens.every((token) => {
    if (fullName.includes(token)) return true;
    if (email.includes(token)) return true;
    if (local.includes(token)) return true;
    return parts.some((part) => part.startsWith(token) || part.includes(token));
  });
}

/** Higher = better autosuggest rank (prefix on name parts wins). */
export function rosterMatchScore(entry: RosterEntry, query: string): number {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return 0;

  const fullName = entry.full_name?.toLowerCase() ?? "";
  const parts = nameParts(fullName);
  const email = entry.email?.toLowerCase() ?? "";
  const local = emailLocalPart(entry.email).toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (fullName === token) score += 100;
    else if (fullName.startsWith(token)) score += 80;
    else if (parts.some((part) => part === token)) score += 70;
    else if (parts.some((part) => part.startsWith(token))) score += 60;
    else if (parts.some((part) => part.includes(token))) score += 40;
    else if (local.startsWith(token)) score += 35;
    else if (email.includes(token)) score += 20;
    else return -1;
  }
  return score;
}

export function searchAndSortRoster(roster: RosterEntry[], query: string): RosterEntry[] {
  const trimmed = query.trim();
  const sorted = [...roster].sort((a, b) => baseName(a).localeCompare(baseName(b)));

  if (!trimmed) return sorted;

  return sorted
    .map((entry) => ({ entry, score: rosterMatchScore(entry, trimmed) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score || baseName(a.entry).localeCompare(baseName(b.entry)))
    .map((row) => row.entry);
}

export { baseName as rosterBaseName };
