import type { TestQuestion } from "@/lib/types";

export type McqChoice = { key: string; text: string };

const DEFAULT_LETTERS = ["A", "B", "C", "D", "E"] as const;

/** Pull A–E style options out of a prompt when structured choices are missing. */
function choicesFromPrompt(prompt: string): McqChoice[] | null {
  const matches = [
    ...prompt.matchAll(
      /(?:^|\n)\s*(?:\(?([A-Ea-e])\)?[.):]\s*)([^\n]+)/g,
    ),
  ];
  if (matches.length < 2) return null;
  const seen = new Set<string>();
  const choices: McqChoice[] = [];
  for (const match of matches) {
    const key = (match[1] ?? "").toUpperCase();
    const text = (match[2] ?? "").trim();
    if (!key || !text || seen.has(key)) continue;
    seen.add(key);
    choices.push({ key, text });
  }
  return choices.length >= 2 ? choices : null;
}

/**
 * Resolve selectable MCQ options for a student-facing question.
 * Prefer stored choices; otherwise parse from the prompt; otherwise letter keys A–E.
 */
export function resolveMcqChoices(question: {
  prompt: string;
  question_type?: string | null;
  choices?: McqChoice[] | null;
}): McqChoice[] | null {
  if (question.question_type !== "mcq") return null;
  if (question.choices && question.choices.length > 0) {
    return question.choices.map((c) => ({
      key: c.key.toUpperCase(),
      text: c.text?.trim() ? c.text.trim() : c.key.toUpperCase(),
    }));
  }
  const fromPrompt = choicesFromPrompt(question.prompt);
  if (fromPrompt) return fromPrompt;
  return DEFAULT_LETTERS.map((key) => ({ key, text: key }));
}

export function isMcqQuestion(question: Pick<TestQuestion, "question_type">): boolean {
  return question.question_type === "mcq";
}
