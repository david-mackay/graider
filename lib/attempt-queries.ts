import { and, eq } from "drizzle-orm";
import { testAttempts } from "@/drizzle/schema";

/** Digital student takes only — paper scans use source teacher_ocr and may stack. */
export function digitalStudentAttemptWhere(testId: string, studentId: string) {
  return and(
    eq(testAttempts.testId, testId),
    eq(testAttempts.studentId, studentId),
    eq(testAttempts.source, "student"),
  );
}
