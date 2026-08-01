export type QuestionType = "open" | "mcq";

export type McqChoice = {
  key: string;
  text: string;
};

/** Normalize a student/teacher MCQ answer to a single uppercase letter, or null. */
export function normalizeMcqLetter(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const direct = trimmed.match(/^([A-Ea-e])\b/);
  if (direct) return direct[1].toUpperCase();

  const option = trimmed.match(/\b(?:option|answer|choice)\s*[:\-]?\s*([A-Ea-e])\b/i);
  if (option) return option[1].toUpperCase();

  const paren = trimmed.match(/^\(([A-Ea-e])\)/);
  if (paren) return paren[1].toUpperCase();

  const lone = trimmed.match(/^([A-Ea-e])[\.\)\:\-]/);
  if (lone) return lone[1].toUpperCase();

  // Last resort: single letter somewhere in short OCR noise
  if (trimmed.length <= 8) {
    const any = trimmed.match(/\b([A-Ea-e])\b/);
    if (any) return any[1].toUpperCase();
  }

  return null;
}

export function gradeMcqExact(params: {
  teacherAnswer: string;
  studentAnswer: string;
  marks: number;
}): { marks_earned: number; feedback: string } {
  const expected = normalizeMcqLetter(params.teacherAnswer);
  const got = normalizeMcqLetter(params.studentAnswer);

  if (!expected) {
    return {
      marks_earned: 0,
      feedback: "Answer key letter is missing — check the review screen.",
    };
  }
  if (!got) {
    return {
      marks_earned: 0,
      feedback: "Incorrect — no clear answer was recorded.",
    };
  }
  if (got === expected) {
    return {
      marks_earned: params.marks,
      feedback: "Correct",
    };
  }
  return {
    marks_earned: 0,
    feedback: "Incorrect",
  };
}

export function coerceQuestionType(value: unknown): QuestionType {
  return value === "mcq" ? "mcq" : "open";
}

export function coerceChoices(value: unknown): McqChoice[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const choices: McqChoice[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const keyRaw =
      typeof record.key === "string"
        ? record.key.trim()
        : typeof record.letter === "string"
          ? record.letter.trim()
          : "";
    const text = typeof record.text === "string" ? record.text.trim() : "";
    const key = normalizeMcqLetter(keyRaw) ?? (keyRaw.length === 1 ? keyRaw.toUpperCase() : "");
    if (!key) continue;
    choices.push({ key, text });
  }
  return choices.length > 0 ? choices : null;
}

/** Cheap local check: is there enough PDF text to try the text LLM? */
export function assessPdfText(raw: string): { usable: boolean; text: string } {
  const text = raw.replace(/\u0000/g, "").trim();
  const letters = (text.match(/[A-Za-z0-9]/g) ?? []).length;
  const alnumRatio = text.length === 0 ? 0 : letters / text.length;

  if (letters < 40) return { usable: false, text };
  if (alnumRatio < 0.55) return { usable: false, text };

  return { usable: true, text: text.slice(0, 120_000) };
}

/** Derive test-level MCQ badge from linked questions. */
export function deriveTestQuestionMix(
  types: QuestionType[],
): "open" | "mcq" | "mixed" {
  if (types.length === 0) return "open";
  const hasOpen = types.some((t) => t === "open");
  const hasMcq = types.some((t) => t === "mcq");
  if (hasOpen && hasMcq) return "mixed";
  if (hasMcq) return "mcq";
  return "open";
}
