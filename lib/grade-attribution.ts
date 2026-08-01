export type GradeAttribution = "exact" | "ai" | "teacher";

/** How an automatic grade should be attributed (GR-08). */
export function gradeAttributionForQuestionType(
  questionType: string | null | undefined,
): Exclude<GradeAttribution, "teacher"> {
  return questionType === "mcq" ? "exact" : "ai";
}
