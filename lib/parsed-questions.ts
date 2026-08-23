import type { ParsedImportQuestion } from "@/lib/types";
import { citedArray, citedNumber, citedString, minConfidence, unwrapCitedLeaf } from "@/lib/reducto-confidence";

/** Normalize LLM / Reducto question rows into ParsedImportQuestion. */
export function normalizeParsedQuestions(raw: unknown): ParsedImportQuestion[] {
  const rows = citedArray(raw);
  const results: ParsedImportQuestion[] = [];
  for (const entry of rows) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const promptField = citedString(record.prompt);
    const correctField = citedString(record.correct_answer ?? record.correctAnswer);
    const prompt = promptField.text;
    const correctAnswer = correctField.text;
    const marksLeaf = unwrapCitedLeaf(record.marks);
    const marksRaw = Number(marksLeaf.value);
    const marks = Number.isFinite(marksRaw) ? Math.max(0, Math.round(marksRaw)) : 1;
    const topicField = citedString(record.topic);
    const topic = topicField.text ? topicField.text : null;
    const typeLeaf = unwrapCitedLeaf(record.question_type ?? record.questionType);
    const questionType =
      typeLeaf.value === "mcq" ? "mcq" : "open";
    const numberLeaf = citedNumber(record.question_number ?? record.questionNumber ?? record.number);
    const questionNumber =
      numberLeaf.value !== null && numberLeaf.value > 0 ? Math.floor(numberLeaf.value) : null;
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
        parsed.push({ key, text: text || key });
      }
      choices = parsed.length > 0 ? parsed : null;
    }
    // Structured choices imply MCQ even if the model forgot question_type.
    const resolvedType: "open" | "mcq" =
      questionType === "mcq" || (choices?.length ?? 0) > 0 ? "mcq" : "open";
    // Best-effort: keep rows that have at least a prompt OR a correct answer.
    if (!prompt && !correctAnswer) continue;
    results.push({
      prompt: prompt || (correctAnswer ? `Question ${questionNumber ?? results.length + 1}` : ""),
      correct_answer: correctAnswer || (resolvedType === "mcq" ? "" : "—"),
      marks: resolvedType === "mcq" ? Math.max(1, marks || 1) : marks || 1,
      topic,
      question_type: resolvedType,
      choices,
      question_number: questionNumber,
      parse_confidence: minConfidence(promptField.parseConfidence, correctField.parseConfidence),
      extract_confidence: minConfidence(
        promptField.extractConfidence,
        correctField.extractConfidence,
      ),
      needs_review:
        promptField.needsReview ||
        correctField.needsReview ||
        marksLeaf.needsReview ||
        numberLeaf.needsReview,
    });
  }
  return results;
}
