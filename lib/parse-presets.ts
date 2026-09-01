/**
 * One Reducto pipeline for every upload: handwriting over print,
 * whether the container is a multi-page PDF or an array of photos.
 * Legacy preset ids are still accepted on the wire and ignored.
 */

export const DOCUMENT_PARSE_PRESETS = [
  "typed_pdf",
  "scanned_or_photo",
  "mcq_letter_key",
  "circled_mcq",
  "handwritten_open",
] as const;

export type DocumentParsePreset = (typeof DOCUMENT_PARSE_PRESETS)[number];

/** Canonical id stored on jobs after the unified pipeline. */
export const UNIFIED_PARSE_PRESET: DocumentParsePreset = "handwritten_open";

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
    id: UNIFIED_PARSE_PRESET,
    label: "Printed + handwriting",
    hint: "PDF pages or photos. Reads printed stems and handwritten marks together.",
  },
];

const PRESET_SET = new Set<string>(DOCUMENT_PARSE_PRESETS);

export function isDocumentParsePreset(value: unknown): value is DocumentParsePreset {
  return typeof value === "string" && PRESET_SET.has(value);
}

export function defaultPresetForSurface(_surface?: ParseSurface): DocumentParsePreset {
  return UNIFIED_PARSE_PRESET;
}

export function presetsForSurface(_surface: ParseSurface): ParsePresetOption[] {
  return PARSE_PRESET_OPTIONS;
}

/** Incoming job/FormData values are accepted but always run the unified pipeline. */
export function coerceParsePreset(
  _raw?: unknown,
  _surface?: ParseSurface,
): DocumentParsePreset {
  return UNIFIED_PARSE_PRESET;
}

export type ReductoParseMapping = {
  agenticText: boolean;
  includeImages: boolean;
  intelligentOrdering: boolean;
  deepExtract: boolean;
  promptSuffix: string;
};

export const UNIFIED_REDUCTO_MAPPING: ReductoParseMapping = {
  agenticText: true,
  includeImages: true,
  intelligentOrdering: true,
  deepExtract: true,
  promptSuffix:
    "The file may be a multi-page PDF or a set of photos of the same paper. " +
    "Printed stems, typed text, scans, and handwriting can appear on the same page. " +
    "Read printed content carefully and transcribe handwritten answers exactly. " +
    "For multiple choice, return the selected letter only when circled, bubbled, crossed, or highlighted. " +
    "Do not invent missing text. Extract every item — do not truncate.",
};

export function mapPresetToReducto(_preset?: DocumentParsePreset): ReductoParseMapping {
  return UNIFIED_REDUCTO_MAPPING;
}
