/**
 * Document-type presets for Reducto parse/extract.
 * Teachers pick a preset before upload; we map it to agentic OCR / deep extract.
 */

export const DOCUMENT_PARSE_PRESETS = [
  "typed_pdf",
  "scanned_or_photo",
  "mcq_letter_key",
  "circled_mcq",
  "handwritten_open",
] as const;

export type DocumentParsePreset = (typeof DOCUMENT_PARSE_PRESETS)[number];

export type ParseSurface =
  | "answer_key_pdf"
  | "answer_key_photo"
  | "question_bank_import"
  | "test_import"
  | "student_ocr"
  | "grade_stack";

export type ParsePresetOption = {
  id: DocumentParsePreset;
  label: string;
  hint: string;
};

export const PARSE_PRESET_OPTIONS: ParsePresetOption[] = [
  {
    id: "typed_pdf",
    label: "Typed PDF",
    hint: "Clean digital text — fastest, no extra OCR pass.",
  },
  {
    id: "scanned_or_photo",
    label: "Scanned / photo",
    hint: "Faded scans, scan PDFs, or camera photos of printed pages.",
  },
  {
    id: "mcq_letter_key",
    label: "MCQ letter key",
    hint: "Letter-only keys like 1. B  2. A — long lists OK.",
  },
  {
    id: "circled_mcq",
    label: "Circled / bubbled MCQ",
    hint: "Circles, bubbles, or highlighted option letters.",
  },
  {
    id: "handwritten_open",
    label: "Handwritten answers",
    hint: "Open written responses in pen or pencil.",
  },
];

const PRESET_SET = new Set<string>(DOCUMENT_PARSE_PRESETS);

export function isDocumentParsePreset(value: unknown): value is DocumentParsePreset {
  return typeof value === "string" && PRESET_SET.has(value);
}

export function defaultPresetForSurface(surface: ParseSurface): DocumentParsePreset {
  switch (surface) {
    case "answer_key_pdf":
    case "question_bank_import":
    case "test_import":
      return "typed_pdf";
    case "answer_key_photo":
      return "scanned_or_photo";
    case "student_ocr":
    case "grade_stack":
      return "handwritten_open";
    default:
      return "typed_pdf";
  }
}

const MCQ_PARSE_PRESETS = new Set<DocumentParsePreset>(["mcq_letter_key", "circled_mcq"]);

const STUDENT_OCR_SURFACES = new Set<ParseSurface>(["student_ocr", "grade_stack"]);

export function presetsForSurface(surface: ParseSurface): ParsePresetOption[] {
  if (STUDENT_OCR_SURFACES.has(surface)) {
    return PARSE_PRESET_OPTIONS.filter((option) => !MCQ_PARSE_PRESETS.has(option.id));
  }
  return PARSE_PRESET_OPTIONS.filter((option) => option.id !== "circled_mcq");
}

/** Coerce FormData / job payload values; unknown → surface default. */
export function coerceParsePreset(
  raw: unknown,
  surface: ParseSurface,
): DocumentParsePreset {
  let resolved: DocumentParsePreset;
  if (isDocumentParsePreset(raw)) resolved = raw;
  else if (typeof raw === "string" && isDocumentParsePreset(raw.trim())) {
    resolved = raw.trim() as DocumentParsePreset;
  } else {
    resolved = defaultPresetForSurface(surface);
  }
  // Circled/bubbled MCQ is not reliable in Reducto yet, and picking it for
  // handwritten papers splits “choose N of M” items into fake extra questions.
  if (STUDENT_OCR_SURFACES.has(surface) && MCQ_PARSE_PRESETS.has(resolved)) {
    return defaultPresetForSurface(surface);
  }
  return resolved;
}

export type ReductoParseMapping = {
  agenticText: boolean;
  includeImages: boolean;
  intelligentOrdering: boolean;
  deepExtract: boolean;
  promptSuffix: string;
};

export function mapPresetToReducto(preset: DocumentParsePreset): ReductoParseMapping {
  switch (preset) {
    case "typed_pdf":
      return {
        agenticText: false,
        includeImages: false,
        intelligentOrdering: false,
        deepExtract: false,
        promptSuffix:
          "Document is a clean typed PDF with embedded text. Prefer exact printed content. " +
          "For MCQ questions with printed options, always fill choices with every A–E option's full text.",
      };
    case "scanned_or_photo":
      return {
        agenticText: true,
        includeImages: true,
        intelligentOrdering: true,
        deepExtract: true,
        promptSuffix:
          "Document is a scan, scan PDF, or photo — correct OCR errors; read faded or skewed text carefully.",
      };
    case "mcq_letter_key":
      return {
        agenticText: true,
        includeImages: false,
        intelligentOrdering: true,
        deepExtract: true,
        promptSuffix:
          "This is an MCQ letter-only answer key (e.g. 1. B  2. A). " +
          "One row per number; prompt like 'Question N'; correct_answer is the letter only; choices null. " +
          "Extract every item — do not truncate long lists.",
      };
    case "circled_mcq":
      return {
        agenticText: true,
        includeImages: true,
        intelligentOrdering: true,
        deepExtract: false,
        promptSuffix:
          "Focus on circled, bubbled, crossed, or highlighted option letters. " +
          "Answer is the selected letter only (A–E). Always set question_index from printed numbers. " +
          "If the stem is unclear, use prompt 'Question N'.",
      };
    case "handwritten_open":
      return {
        agenticText: true,
        includeImages: true,
        intelligentOrdering: true,
        deepExtract: false,
        promptSuffix:
          "Focus on handwritten open answers. Transcribe student writing exactly; do not invent missing text.",
      };
    default:
      return mapPresetToReducto("typed_pdf");
  }
}
