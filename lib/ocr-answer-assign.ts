/**
 * Map OCR rows onto answer-key slots without reusing the first row
 * when every fragment shares the same printed question_index.
 */
export function assignOcrAnswersToKeys(
  answers: Array<{ answer?: string | null; question_index?: number | null }>,
  keyCount: number,
): string[] {
  const result = Array.from({ length: keyCount }, () => "");
  if (keyCount <= 0) return result;

  const slots = answers.map((a) => ({
    answer: (a.answer ?? "").trim(),
    index:
      typeof a.question_index === "number" && Number.isFinite(a.question_index)
        ? Math.trunc(a.question_index)
        : null,
  }));

  const numbered = slots.filter((s): s is { answer: string; index: number } => s.index !== null);
  const unique = new Set(numbered.map((s) => s.index));
  const indexesAreUnique = numbered.length > 0 && unique.size === numbered.length;

  if (!indexesAreUnique) {
    return Array.from({ length: keyCount }, (_, i) => slots[i]?.answer ?? "");
  }

  for (const s of numbered) {
    let slot: number | null = null;
    if (s.index >= 1 && s.index <= keyCount) slot = s.index - 1;
    else if (s.index >= 0 && s.index < keyCount) slot = s.index;
    if (slot !== null && result[slot] === "") result[slot] = s.answer;
  }

  let next = 0;
  for (const s of slots) {
    if (s.index !== null) continue;
    while (next < keyCount && result[next] !== "") next += 1;
    if (next >= keyCount) break;
    if (s.answer) {
      result[next] = s.answer;
      next += 1;
    }
  }

  return result;
}
