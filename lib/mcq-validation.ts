import { normalizeMcqLetter, type McqChoice } from "@/lib/mcq";

export function normalizeMcqChoices(
  choices: Array<{ key?: string; text?: string }> | null | undefined,
): McqChoice[] | null {
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const normalized = choices
    .filter(
      (c): c is { key: string; text: string } =>
        typeof c?.key === "string" && typeof c?.text === "string",
    )
    .map((c) => ({
      key: c.key.trim().toUpperCase().slice(0, 1),
      text: c.text.trim(),
    }))
    .filter((c) => /^[A-E]$/.test(c.key));
  return normalized.length > 0 ? normalized : null;
}

/** Validate MCQ answer key for question bank create/update (Q-03, Q-04). */
export function validateMcqAnswerKey(params: {
  correctAnswer: string;
  choices?: Array<{ key: string; text: string }> | null;
}): { ok: true; letter: string } | { ok: false; reason: string } {
  const letter = normalizeMcqLetter(params.correctAnswer);
  if (!letter || !/^[A-E]$/.test(letter)) {
    return { ok: false, reason: "MCQ correct_answer must be a letter A–E." };
  }
  if (
    params.choices &&
    params.choices.length > 0 &&
    !params.choices.some((c) => c.key.toUpperCase() === letter)
  ) {
    return { ok: false, reason: "MCQ correct_answer must match one of the choice keys." };
  }
  return { ok: true, letter };
}
