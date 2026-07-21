import type { ParsedImportQuestion } from "@/lib/types";

export type ExistingTestQuestion = {
  questionId: string;
  sortOrder: number;
  prompt: string;
  correctAnswer: string;
  marks: number;
  topic: string | null;
  questionType: string;
  choices: Array<{ key: string; text: string }> | null;
};

export type QuestionMergePatch = {
  questionId: string;
  prompt?: string;
  correctAnswer?: string;
  marks?: number;
  topic?: string | null;
  questionType?: "open" | "mcq";
  choices?: Array<{ key: string; text: string }> | null;
};

export type TestEnrichPlan = {
  updates: QuestionMergePatch[];
  inserts: ParsedImportQuestion[];
  matched: number;
  created: number;
  skipped: number;
};

const PLACEHOLDER_PROMPT = /^question\s+\d+$/i;
const EMPTY_ANSWER = /^(—|--|-|n\/?a|none|tbd|\.|\s*)$/i;

export function isPlaceholderPrompt(prompt: string): boolean {
  const trimmed = prompt.trim();
  return !trimmed || PLACEHOLDER_PROMPT.test(trimmed);
}

export function isEmptyAnswer(answer: string): boolean {
  const trimmed = answer.trim();
  return !trimmed || EMPTY_ANSWER.test(trimmed);
}

function normalizePromptKey(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^question\s+\d+[:.)\-\s]*/i, "")
    .trim();
}

/**
 * Intelligently merge newly parsed PDF questions into an existing test.
 * Prefers question_number, then sort index, then normalized prompt.
 * Never overwrites richer existing data with thinner incoming data.
 */
export function planTestEnrichment(
  existing: ExistingTestQuestion[],
  incoming: ParsedImportQuestion[],
): TestEnrichPlan {
  const updates: QuestionMergePatch[] = [];
  const inserts: ParsedImportQuestion[] = [];
  let matched = 0;
  let skipped = 0;

  const usedExisting = new Set<string>();
  const byNumber = new Map<number, ExistingTestQuestion>();
  const byPrompt = new Map<string, ExistingTestQuestion>();

  for (const row of existing) {
    byNumber.set(row.sortOrder + 1, row);
    const key = normalizePromptKey(row.prompt);
    if (key && !PLACEHOLDER_PROMPT.test(row.prompt)) {
      byPrompt.set(key, row);
    }
  }

  incoming.forEach((parsed, index) => {
    const number =
      typeof parsed.question_number === "number" && parsed.question_number > 0
        ? parsed.question_number
        : index + 1;

    let target =
      byNumber.get(number) ??
      (parsed.prompt && !isPlaceholderPrompt(parsed.prompt)
        ? byPrompt.get(normalizePromptKey(parsed.prompt))
        : undefined);

    // Fall back to same index when counts align and number didn't match.
    if (!target && existing[index] && !usedExisting.has(existing[index]!.questionId)) {
      target = existing[index];
    }

    if (target && usedExisting.has(target.questionId)) {
      target = undefined;
    }

    if (!target) {
      inserts.push(parsed);
      return;
    }

    usedExisting.add(target.questionId);
    matched += 1;

    const patch: QuestionMergePatch = { questionId: target.questionId };
    let changed = false;

    if (
      parsed.prompt &&
      !isPlaceholderPrompt(parsed.prompt) &&
      (isPlaceholderPrompt(target.prompt) || parsed.prompt.length > target.prompt.length + 20)
    ) {
      if (parsed.prompt !== target.prompt) {
        patch.prompt = parsed.prompt;
        changed = true;
      }
    }

    if (!isEmptyAnswer(parsed.correct_answer) && isEmptyAnswer(target.correctAnswer)) {
      patch.correctAnswer = parsed.correct_answer;
      changed = true;
    }

    if (
      parsed.question_type === "mcq" &&
      target.questionType !== "mcq" &&
      (!isEmptyAnswer(parsed.correct_answer) || (parsed.choices?.length ?? 0) > 0)
    ) {
      patch.questionType = "mcq";
      changed = true;
    }

    if (
      parsed.choices &&
      parsed.choices.length > 0 &&
      (!target.choices || target.choices.length === 0)
    ) {
      patch.choices = parsed.choices;
      changed = true;
    }

    if (typeof parsed.marks === "number" && parsed.marks > 0 && target.marks <= 0) {
      patch.marks = parsed.marks;
      changed = true;
    }

    if (parsed.topic && !target.topic) {
      patch.topic = parsed.topic;
      changed = true;
    }

    if (changed) {
      updates.push(patch);
    } else {
      skipped += 1;
    }
  });

  return {
    updates,
    inserts,
    matched,
    created: inserts.length,
    skipped,
  };
}
