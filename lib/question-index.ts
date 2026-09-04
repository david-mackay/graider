/**
 * OCR stores the printed question number (1, 2, 3…).
 * Review used to treat it as 0-based and add 1, so Q1 showed as 2.
 */

export function formatPrintedQuestionNumber(
  questionIndex: number | null | undefined,
): string {
  if (typeof questionIndex !== "number" || !Number.isFinite(questionIndex)) {
    return "";
  }
  const n = Math.trunc(questionIndex);
  if (n === 0) return "1";
  return String(n);
}

export function parsePrintedQuestionNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.trunc(parsed);
}

/** Accept JSON numbers or numeric strings from review/commit payloads. */
export function coercePrintedQuestionIndex(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}
