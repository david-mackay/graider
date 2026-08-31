/** Prefer a digital take so paper scans do not hide Start / Resume for the student. */
export function pickStudentFacingAttempt<
  T extends { test_id: string; source?: string | null; status: string },
>(attempts: T[], testId: string): T | null {
  const digital = attempts.filter((a) => a.test_id === testId && a.source !== "teacher_ocr");
  if (digital.length === 0) return null;
  return digital.find((a) => a.status === "draft") ?? digital[0] ?? null;
}
