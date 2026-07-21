import type { ParsedImportQuestion } from "@/lib/types";

/** Normalize LLM / Reducto question rows into ParsedImportQuestion. */
export function normalizeParsedQuestions(raw: unknown): ParsedImportQuestion[] {
  if (!Array.isArray(raw)) return [];
  const results: ParsedImportQuestion[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
    const correctAnswer =
      typeof record.correct_answer === "string"
        ? record.correct_answer.trim()
        : typeof record.correctAnswer === "string"
          ? record.correctAnswer.trim()
          : "";
    const marksRaw = Number(record.marks);
    const marks = Number.isFinite(marksRaw) ? Math.max(0, Math.round(marksRaw)) : 1;
    const topic =
      typeof record.topic === "string" && record.topic.trim() ? record.topic.trim() : null;
    const questionType =
      record.question_type === "mcq" || record.questionType === "mcq" ? "mcq" : "open";
    const numberRaw = Number(record.question_number ?? record.questionNumber ?? record.number);
    const questionNumber =
      Number.isFinite(numberRaw) && numberRaw > 0 ? Math.floor(numberRaw) : null;
    const choicesRaw = record.choices;
    let choices: ParsedImportQuestion["choices"] = null;
    if (Array.isArray(choicesRaw) && choicesRaw.length > 0) {
      const parsed: NonNullable<ParsedImportQuestion["choices"]> = [];
      for (const choice of choicesRaw) {
        if (typeof choice !== "object" || choice === null) continue;
        const c = choice as Record<string, unknown>;
        const key =
          typeof c.key === "string"
            ? c.key.trim().toUpperCase().slice(0, 1)
            : typeof c.letter === "string"
              ? c.letter.trim().toUpperCase().slice(0, 1)
              : "";
        const text = typeof c.text === "string" ? c.text.trim() : "";
        if (!key || !/^[A-E]$/.test(key)) continue;
        parsed.push({ key, text });
      }
      choices = parsed.length > 0 ? parsed : null;
    }
    // Best-effort: keep rows that have at least a prompt OR a correct answer.
    if (!prompt && !correctAnswer) continue;
    results.push({
      prompt: prompt || (correctAnswer ? `Question ${questionNumber ?? results.length + 1}` : ""),
      correct_answer: correctAnswer || (questionType === "mcq" ? "" : "—"),
      marks: questionType === "mcq" ? Math.max(1, marks || 1) : marks || 1,
      topic,
      question_type: questionType,
      choices,
      question_number: questionNumber,
    });
  }
  return results;
}
