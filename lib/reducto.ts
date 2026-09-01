import Reducto, { toFile } from "reductoai";
import { normalizeParsedQuestions } from "@/lib/parsed-questions";
import {
  coerceParsePreset,
  mapPresetToReducto,
  UNIFIED_PARSE_PRESET,
  type DocumentParsePreset,
} from "@/lib/parse-presets";
import type { OcrAnswer, OcrPage, ParsedImportQuestion } from "@/lib/types";
import { citedArray, citedNumber, citedString, minConfidence, unwrapCitedLeaf } from "@/lib/reducto-confidence";

export type { DocumentParsePreset } from "@/lib/parse-presets";
export type ImagePayload = {
  filename: string;
  mimeType: string;
  base64: string;
};

const ANSWER_KEY_SYSTEM_PROMPT =
  "This is a teacher answer key or exam paper with model answers, as a multi-page PDF or photos. " +
  "Printed stems and handwritten or circled answers can appear together. " +
  "Extract every question in document order for a review screen the teacher will edit. " +
  "Prefer confident values; omit rather than invent. " +
  "For multiple-choice: set question_type to mcq, put the correct letter only in correct_answer (A–E), " +
  "and ALWAYS include choices when option text is visible on the page " +
  "(each choice needs key A–E and the full option wording without the leading letter). " +
  "Do not leave choices empty when A/B/C/D/(E) stems appear under a question. " +
  "Circled, bubbled, highlighted, or marked options count as the answer. " +
  "Letter-only keys like '1. B  2. A' (no option wording) become mcq rows with prompt 'Question N' and choices null. " +
  "Open-ended items use question_type open with the full model answer in correct_answer. " +
  "Extract every item — do not truncate the list.";

const TEST_PAPER_SYSTEM_PROMPT =
  "This is a student-facing test or exam paper as a multi-page PDF or photos " +
  "(questions, often with multiple-choice options; printed and handwritten content may mix). " +
  "Extract the test title from the header when present, and every question in document order. " +
  "Prefer confident values; omit rather than invent. " +
  "When a question shows options A–E (or A–D), set question_type to mcq and ALWAYS populate choices " +
  "with every visible option: key is the letter, text is the option wording without the leading letter. " +
  "Put the correct letter in correct_answer only when an answer key is printed on the same paper; " +
  "otherwise use an empty correct_answer for MCQ stems (teachers may merge an answer key later). " +
  "Open-ended items use question_type open. Extract every question — do not truncate.";

const QUESTION_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    question_number: {
      type: "integer",
      description: "Printed question number when visible; otherwise sequential order starting at 1",
    },
    prompt: {
      type: "string",
      description: "Question stem / prompt text. Use 'Question N' if only a letter key is present.",
    },
    correct_answer: {
      type: "string",
      description:
        "Model answer. For MCQ use the letter only (e.g. B). For open questions use the full expected answer.",
    },
    marks: {
      type: "integer",
      description: "Point value if shown; default 1 for MCQ and 1 when unknown",
    },
    question_type: {
      type: "string",
      enum: ["open", "mcq"],
      description: "mcq when options or letter answers; otherwise open",
    },
    choices: {
      type: "array",
      description:
        "Required for MCQ when option wording is on the page. " +
        "One entry per letter A–E with the option text (omit leading 'A.' / 'A)'). " +
        "Empty/omit only for letter-only answer keys with no option text.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: {
            type: "string",
            enum: ["A", "B", "C", "D", "E"],
            description: "Option letter",
          },
          text: {
            type: "string",
            description: "Option wording without the leading letter",
          },
        },
        required: ["key", "text"],
      },
    },
    topic: {
      type: "string",
      description: "Topic or section label if clearly stated",
    },
  },
  required: ["prompt", "correct_answer", "marks", "question_type"],
} as const;

const QUESTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      description: "All questions / answer-key rows in order",
      items: QUESTION_ITEM_SCHEMA,
    },
  },
  required: ["questions"],
} as const;

const TEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      description: "Test or paper title from the document header",
    },
    questions: {
      type: "array",
      description: "All questions in order",
      items: QUESTION_ITEM_SCHEMA,
    },
  },
  required: ["title", "questions"],
} as const;

export type ReductoUploadInput = {
  buffer: Buffer;
  filename: string;
  mimeType?: string;
};

function getClient(): Reducto {
  const apiKey = process.env.REDUCTO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Document parsing is not configured (missing REDUCTO_API_KEY).");
  }
  return new Reducto({ apiKey });
}

export function isReductoConfigured(): boolean {
  return Boolean(process.env.REDUCTO_API_KEY?.trim());
}

function unwrapExtractResult(result: unknown): Record<string, unknown> {
  // Sync extract returns result as a list of length 1 (or a single object).
  if (Array.isArray(result) && result.length > 0) {
    const first = result[0];
    if (typeof first === "object" && first !== null) {
      return first as Record<string, unknown>;
    }
  }
  if (typeof result === "object" && result !== null && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return {};
}

export type ReductoWorkProgress = {
  percent: number;
  label: string;
};

function mapRange(
  onProgress: ((progress: ReductoWorkProgress) => void | Promise<void>) | undefined,
  start: number,
  end: number,
  localPercent: number,
  label: string,
) {
  if (!onProgress) return;
  const clamped = Math.min(100, Math.max(0, localPercent));
  return onProgress({
    percent: Math.round(start + ((end - start) * clamped) / 100),
    label,
  });
}

async function uploadFiles(
  inputs: ReductoUploadInput[],
  onProgress?: (progress: ReductoWorkProgress) => void | Promise<void>,
): Promise<string[]> {
  if (inputs.length === 0) {
    throw new Error("Upload at least one document or photo.");
  }
  const client = getClient();
  const fileIds: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!;
    await onProgress?.({
      percent: Math.round((i / inputs.length) * 100),
      label: `Sending file ${i + 1} of ${inputs.length}…`,
    });
    const file = await toFile(input.buffer, input.filename, {
      type: input.mimeType || guessMime(input.filename),
    });
    const uploaded = await client.upload({ file });
    if (!uploaded.file_id) {
      throw new Error("Failed to upload document for parsing.");
    }
    fileIds.push(uploaded.file_id);
    await onProgress?.({
      percent: Math.round(((i + 1) / inputs.length) * 100),
      label: `Sent file ${i + 1} of ${inputs.length}`,
    });
  }
  return fileIds;
}

function guessMime(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

async function parseFileToJobId(
  client: Reducto,
  fileId: string,
  preset: DocumentParsePreset,
): Promise<string> {
  const mapping = mapPresetToReducto(preset);
  const parsed = await client.parse.run({
    input: fileId,
    enhance: {
      agentic: mapping.agenticText ? [{ scope: "text" as const }] : [],
      intelligent_ordering: mapping.intelligentOrdering,
    },
    settings: {
      extraction_mode: "hybrid",
      ocr_system: "standard",
    },
  });
  const jobId =
    typeof parsed === "object" &&
    parsed !== null &&
    "job_id" in parsed &&
    typeof (parsed as { job_id?: unknown }).job_id === "string"
      ? (parsed as { job_id: string }).job_id
      : null;
  if (!jobId) {
    throw new Error("Document parse did not return a job id.");
  }
  return `jobid://${jobId}`;
}

async function extractWithSchema(params: {
  fileIds: string[];
  schema: unknown;
  systemPrompt: string;
  preset: DocumentParsePreset;
  onProgress?: (progress: ReductoWorkProgress) => void | Promise<void>;
}): Promise<Record<string, unknown>> {
  const client = getClient();
  const mapping = mapPresetToReducto(params.preset);
  const systemPrompt = `${params.systemPrompt} ${mapping.promptSuffix}`.trim();

  // Multi-doc extract only accepts jobid:// references (not raw upload file ids).
  let input: string | string[];
  if (params.fileIds.length === 1) {
    input = params.fileIds[0];
  } else {
    input = [];
    for (let i = 0; i < params.fileIds.length; i++) {
      const fileId = params.fileIds[i]!;
      await mapRange(
        params.onProgress,
        0,
        55,
        (i / params.fileIds.length) * 100,
        `Reading document ${i + 1} of ${params.fileIds.length}…`,
      );
      input.push(await parseFileToJobId(client, fileId, params.preset));
    }
    await mapRange(params.onProgress, 0, 55, 100, "Documents ready");
  }

  await params.onProgress?.({
    percent: params.fileIds.length === 1 ? 15 : 60,
    label: "Extracting answers…",
  });

  const response = await client.extract.run({
    input,
    instructions: {
      schema: params.schema,
      system_prompt: systemPrompt,
    },
    // parsing is ignored when input is jobid://; keep for single-file uploads.
    ...(typeof input === "string" && !input.startsWith("jobid://")
      ? {
          parsing: {
            enhance: {
              agentic: mapping.agenticText ? [{ scope: "text" as const }] : [],
              intelligent_ordering: mapping.intelligentOrdering,
            },
            settings: {
              extraction_mode: "hybrid" as const,
              ocr_system: "standard" as const,
            },
          },
        }
      : {}),
    settings: {
      array_extract: true,
      include_images: mapping.includeImages,
      deep_extract: mapping.deepExtract,
      citations: {
        enabled: true,
        numerical_confidence: true,
      },
    },
  });

  if (!("result" in response)) {
    throw new Error("Document extraction is still processing. Try again in a moment.");
  }
  await params.onProgress?.({ percent: 100, label: "Extraction complete" });
  return unwrapExtractResult(response.result);
}

/**
 * Extract answer-key / question-bank rows from PDF or image buffers via Reducto.
 * Best-effort prefill — empty list is allowed so the UI can open editable review.
 */
export async function extractAnswerKeyQuestions(
  inputs: ReductoUploadInput[],
  preset: DocumentParsePreset = UNIFIED_PARSE_PRESET,
  onProgress?: (progress: ReductoWorkProgress) => void | Promise<void>,
): Promise<ParsedImportQuestion[]> {
  const fileIds = await uploadFiles(inputs, (progress) =>
    mapRange(onProgress, 0, 40, progress.percent, progress.label),
  );
  const data = await extractWithSchema({
    fileIds,
    schema: QUESTIONS_SCHEMA,
    systemPrompt: ANSWER_KEY_SYSTEM_PROMPT,
    preset: coerceParsePreset(preset, "answer_key_pdf"),
    onProgress: (progress) => mapRange(onProgress, 40, 100, progress.percent, progress.label),
  });
  return normalizeParsedQuestions(data.questions);
}

export async function extractQuestionBankFromDocument(
  input: ReductoUploadInput,
  preset: DocumentParsePreset = UNIFIED_PARSE_PRESET,
): Promise<ParsedImportQuestion[]> {
  const questions = await extractAnswerKeyQuestions(
    [input],
    coerceParsePreset(preset, "question_bank_import"),
  );
  if (questions.length === 0) {
    throw new Error("No questions found in the PDF.");
  }
  return questions;
}

export async function extractTestFromDocument(
  input: ReductoUploadInput,
  preset: DocumentParsePreset = UNIFIED_PARSE_PRESET,
): Promise<{ title: string; questions: ParsedImportQuestion[] }> {
  const fileIds = await uploadFiles([input]);
  const data = await extractWithSchema({
    fileIds,
    schema: TEST_SCHEMA,
    systemPrompt: TEST_PAPER_SYSTEM_PROMPT,
    preset: coerceParsePreset(preset, "test_import"),
  });
  const title = citedString(data.title).text || "Imported test";
  const questions = normalizeParsedQuestions(data.questions);
  if (questions.length === 0) {
    throw new Error("No questions found in the test PDF.");
  }
  return { title, questions };
}

// ── Student paper OCR ───────────────────────────────────────────────────────

const OCR_ANSWER_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    question: {
      type: "string",
      description:
        "Question stem if printed. For numbered MCQ sheets prefer 'Question N' matching the printed number — do not invent full stems.",
    },
    answer: {
      type: "string",
      description:
        "Student response. For MCQ: the selected letter only (A–E) when circled, bubbled, crossed, highlighted, or otherwise marked. For open items: the written answer as shown (print or handwriting).",
    },
    question_index: {
      type: "integer",
      description:
        "1-based printed question number when visible (1, 2, 3…). Critical for MCQ sheets — always set when a number appears.",
    },
  },
  required: ["question", "answer", "question_index"],
} as const;

const FLAT_ANSWERS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answers: {
      type: "array",
      description: "Every question/answer pair found across the uploaded pages, in order",
      items: OCR_ANSWER_ITEM_SCHEMA,
    },
  },
  required: ["answers"],
} as const;

const STACK_PAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageIndex: {
      type: "integer",
      description: "0-based index matching input image order",
    },
    studentName: {
      type: "string",
      description: "Handwritten student name at the top of the page; empty if unreadable",
    },
    confidence: {
      type: "number",
      description:
        "0–1 confidence for the student name. ≥0.9 clear, 0.4–0.7 messy guess, 0 if missing/unreadable",
    },
    answers: {
      type: "array",
      description: "Q/A pairs on this page",
      items: OCR_ANSWER_ITEM_SCHEMA,
    },
  },
  required: ["pageIndex", "studentName", "confidence", "answers"],
} as const;

const STACK_PAGES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    pages: {
      type: "array",
      description: "One entry per input image, in the same order",
      items: STACK_PAGE_SCHEMA,
    },
  },
  required: ["pages"],
} as const;

const STUDENT_BUCKET_PAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageIndex: {
      type: "integer",
      description: "Global page index supplied by the caller",
    },
    answers: {
      type: "array",
      description: "Q/A pairs on this page",
      items: OCR_ANSWER_ITEM_SCHEMA,
    },
  },
  required: ["pageIndex", "answers"],
} as const;

const STUDENT_BUCKET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    pages: {
      type: "array",
      description: "One entry per input image, in order",
      items: STUDENT_BUCKET_PAGE_SCHEMA,
    },
  },
  required: ["pages"],
} as const;

const STUDENT_PAPER_OCR_PROMPT =
  "These are student exam pages: a multi-page PDF or photos of printed paper with handwriting on top. " +
  "Extract every answered item. Prefer question_index from the printed number. " +
  "Read printed stems and typed text, and transcribe handwritten answers exactly. " +
  "For multiple-choice: the answer is the letter the student selected — circled, bubbled, crossed out alternatives, highlighted, or marked — return that letter only (A–E). " +
  "Do not treat option text as the answer. Do not invent questions or answers. " +
  "If the stem is hard to read but the number and selected letter are clear, use question='Question N' and answer=letter. " +
  "Blank or unreadable items stay empty. Extract every item — do not truncate.";

function imagesToUploads(images: ImagePayload[]): ReductoUploadInput[] {
  return images.map((img) => ({
    buffer: Buffer.from(img.base64, "base64"),
    filename: img.filename || "page.png",
    mimeType: img.mimeType || "image/png",
  }));
}

function coerceOcrAnswer(entry: unknown): OcrAnswer | null {
  if (typeof entry !== "object" || entry === null) return null;
  const record = entry as Record<string, unknown>;
  const question = citedString(record.question);
  const answer = citedString(record.answer);
  if (!question.text && !answer.text) return null;
  const indexLeaf = citedNumber(record.question_index);
  return {
    question: question.text,
    answer: answer.text,
    question_index: indexLeaf.value,
    parse_confidence: minConfidence(question.parseConfidence, answer.parseConfidence),
    extract_confidence: minConfidence(question.extractConfidence, answer.extractConfidence),
    needs_review: question.needsReview || answer.needsReview || indexLeaf.needsReview,
  };
}

function coerceOcrAnswers(raw: unknown): OcrAnswer[] {
  const list = citedArray(raw);
  return list
    .map((entry) => coerceOcrAnswer(entry))
    .filter((entry): entry is OcrAnswer => entry !== null);
}

function clampConfidence(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Flat Q/A extraction for a single attempt / onboarding sample grade. */
export async function extractHandwrittenAnswers(
  images: ImagePayload[],
  preset: DocumentParsePreset = UNIFIED_PARSE_PRESET,
  onProgress?: (progress: ReductoWorkProgress) => void | Promise<void>,
): Promise<OcrAnswer[]> {
  if (images.length === 0) return [];
  const resolved = coerceParsePreset(preset, "student_ocr");
  const fileIds = await uploadFiles(imagesToUploads(images), (progress) =>
    mapRange(onProgress, 0, 40, progress.percent, progress.label),
  );
  const data = await extractWithSchema({
    fileIds,
    schema: FLAT_ANSWERS_SCHEMA,
    systemPrompt: STUDENT_PAPER_OCR_PROMPT,
    preset: resolved,
    onProgress: (progress) => mapRange(onProgress, 40, 100, progress.percent, progress.label),
  });
  return coerceOcrAnswers(data.answers);
}

/**
 * Stack OCR: one page per image, with handwritten name + answers.
 * Used when the teacher uploads a mixed pile of papers.
 */
export async function extractHandwrittenStack(
  images: ImagePayload[],
  preset: DocumentParsePreset = UNIFIED_PARSE_PRESET,
  onProgress?: (progress: ReductoWorkProgress) => void | Promise<void>,
): Promise<OcrPage[]> {
  if (images.length === 0) return [];
  const resolved = coerceParsePreset(preset, "grade_stack");
  const fileIds = await uploadFiles(imagesToUploads(images), (progress) =>
    mapRange(onProgress, 0, 40, progress.percent, progress.label),
  );
  const data = await extractWithSchema({
    fileIds,
    schema: STACK_PAGES_SCHEMA,
    systemPrompt:
      STUDENT_PAPER_OCR_PROMPT +
      ` There are ${images.length} page image(s) in order (pageIndex 0..${images.length - 1}). ` +
      "Return exactly one pages entry per image in the same order. " +
      "Also read the student's handwritten name at the top of each page. " +
      "If the name is clear use confidence ≥ 0.9; messy but guessable 0.4–0.7; missing/unreadable → empty studentName and confidence 0.",
    preset: resolved,
    onProgress: (progress) => mapRange(onProgress, 40, 100, progress.percent, progress.label),
  });

  const pageEntries = citedArray(data.pages);
  return images.map((_image, index): OcrPage => {
    const candidate = pageEntries[index];
    if (typeof candidate !== "object" || candidate === null) {
      return { pageIndex: index, studentNameGuess: "", confidence: 0, answers: [] };
    }
    const record = candidate as Record<string, unknown>;
    const studentName = citedString(record.studentName);
    const nameConfidence = unwrapCitedLeaf(record.confidence);
    const studentNameGuess = studentName.text;
    const confidence = studentNameGuess
      ? clampConfidence(
          nameConfidence.value ??
            minConfidence(studentName.parseConfidence, studentName.extractConfidence) ??
            0,
        )
      : 0;
    return {
      pageIndex: index,
      studentNameGuess,
      confidence,
      answers: coerceOcrAnswers(record.answers),
    };
  });
}

/** OCR one student's pages — Q/A only, no name extraction. */
export async function extractHandwrittenStudentBucket(
  images: ImagePayload[],
  globalPageIndices: number[],
  preset: DocumentParsePreset = UNIFIED_PARSE_PRESET,
): Promise<OcrPage[]> {
  if (images.length === 0) return [];
  const resolved = coerceParsePreset(preset, "grade_stack");
  const fileIds = await uploadFiles(imagesToUploads(images));
  const indexList = globalPageIndices.join(", ");
  const data = await extractWithSchema({
    fileIds,
    schema: STUDENT_BUCKET_SCHEMA,
    systemPrompt:
      STUDENT_PAPER_OCR_PROMPT +
      ` These ${images.length} page(s) belong to ONE student already assigned by the teacher — do NOT read or guess any student name. ` +
      `Use these global pageIndex values exactly, in order: ${indexList}. ` +
      "Return exactly one pages entry per image.",
    preset: resolved,
  });

  const pageEntries = citedArray(data.pages);
  return images.map((_image, index): OcrPage => {
    const globalIndex = globalPageIndices[index] ?? index;
    const candidate = pageEntries[index];
    if (typeof candidate !== "object" || candidate === null) {
      return { pageIndex: globalIndex, studentNameGuess: "", confidence: 0, answers: [] };
    }
    const record = candidate as Record<string, unknown>;
    return {
      pageIndex: globalIndex,
      studentNameGuess: "",
      confidence: 0,
      answers: coerceOcrAnswers(record.answers),
    };
  });
}

/** One Reducto extract per student bucket; skips name OCR. */
export async function extractStudentFirstPreview(
  images: ImagePayload[],
  assignments: { pageIndex: number; studentId: string; parsePreset?: string }[],
  preset: DocumentParsePreset = UNIFIED_PARSE_PRESET,
  onStudentProgress?: (progress: {
    completed: number;
    total: number;
    currentStudentId: string;
    completedStudentIds: string[];
  }) => void | Promise<void>,
): Promise<OcrPage[]> {
  if (images.length === 0) return [];
  const fallback = coerceParsePreset(preset, "grade_stack");

  const byStudent = new Map<string, { pageIndices: number[]; parsePreset: DocumentParsePreset }>();
  for (const assignment of [...assignments].sort((a, b) => a.pageIndex - b.pageIndex)) {
    const existing = byStudent.get(assignment.studentId);
    if (existing) {
      existing.pageIndices.push(assignment.pageIndex);
      continue;
    }
    byStudent.set(assignment.studentId, {
      pageIndices: [assignment.pageIndex],
      parsePreset: coerceParsePreset(assignment.parsePreset ?? fallback, "grade_stack"),
    });
  }

  const pageResults = new Map<number, OcrPage>();
  const studentEntries = [...byStudent.entries()];
  const completedStudentIds: string[] = [];
  for (let i = 0; i < studentEntries.length; i++) {
    const [studentId, { pageIndices, parsePreset }] = studentEntries[i]!;
    await onStudentProgress?.({
      completed: i,
      total: studentEntries.length,
      currentStudentId: studentId,
      completedStudentIds: [...completedStudentIds],
    });
    const studentImages = pageIndices.map((index) => images[index]).filter(Boolean);
    const pages = await extractHandwrittenStudentBucket(studentImages, pageIndices, parsePreset);
    for (const page of pages) {
      pageResults.set(page.pageIndex, page);
    }
    completedStudentIds.push(studentId);
  }
  await onStudentProgress?.({
    completed: studentEntries.length,
    total: studentEntries.length,
    currentStudentId: studentEntries[studentEntries.length - 1]?.[0] ?? "",
    completedStudentIds,
  });

  return images.map((_image, index) =>
    pageResults.get(index) ?? {
      pageIndex: index,
      studentNameGuess: "",
      confidence: 0,
      answers: [],
    },
  );
}

/** Discover test title + questions from photographed student papers. */
export async function parseTestFromStackImages(
  images: ImagePayload[],
  preset: DocumentParsePreset = UNIFIED_PARSE_PRESET,
): Promise<{ title: string; questions: ParsedImportQuestion[] }> {
  if (images.length === 0) {
    throw new Error("At least one image is required to detect a test.");
  }
  const resolved = coerceParsePreset(preset, "grade_stack");
  const fileIds = await uploadFiles(imagesToUploads(images));
  const data = await extractWithSchema({
    fileIds,
    schema: TEST_SCHEMA,
    systemPrompt:
      "These photos are student test papers from the same assessment (printed and/or handwritten). " +
      "Extract the test title (from a header if visible, otherwise a short descriptive title) " +
      "and every question prompt shown across the pages. " +
      "For each question provide a model correct_answer a teacher would use to grade " +
      "(infer from the question when no answer key is visible). " +
      "Use printed mark values when present; otherwise default marks sensibly. " +
      "Set question_type to mcq when options A–E appear; otherwise open. " +
      "ALWAYS include choices with every visible option's full text when options appear. " +
      "Extract every question — do not truncate.",
    preset: resolved,
  });
  const title = citedString(data.title).text || "Stack graded test";
  const questions = normalizeParsedQuestions(data.questions);
  if (questions.length === 0) {
    throw new Error(
      "Could not detect questions on these papers. Pick a test manually or create one first.",
    );
  }
  return { title, questions };
}
