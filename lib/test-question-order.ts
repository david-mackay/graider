/** True when `next` is a permutation of `existing` (same ids, no extras/duplicates). */
export function isQuestionIdPermutation(existing: string[], next: string[]): boolean {
  if (existing.length !== next.length) return false;
  const wanted = new Set(existing);
  if (wanted.size !== existing.length) return false;
  const seen = new Set<string>();
  for (const id of next) {
    if (!wanted.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

export function parseQuestionIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) return null;
    ids.push(item.trim());
  }
  return ids;
}
