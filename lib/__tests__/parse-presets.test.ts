import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  coerceParsePreset,
  defaultPresetForSurface,
  isDocumentParsePreset,
  mapPresetToReducto,
  UNIFIED_PARSE_PRESET,
  UNIFIED_REDUCTO_MAPPING,
} from "@/lib/parse-presets";

describe("parse-presets", () => {
  it("accepts legacy ids but always runs the unified pipeline", () => {
    assert.equal(isDocumentParsePreset("circled_mcq"), true);
    assert.equal(isDocumentParsePreset("nope"), false);
    assert.equal(defaultPresetForSurface("grade_stack"), UNIFIED_PARSE_PRESET);
    assert.equal(coerceParsePreset("typed_pdf", "student_ocr"), UNIFIED_PARSE_PRESET);
    assert.equal(coerceParsePreset("garbage", "answer_key_pdf"), UNIFIED_PARSE_PRESET);
    assert.equal(coerceParsePreset("mcq_letter_key", "grade_stack"), UNIFIED_PARSE_PRESET);
  });

  it("maps every preset to the thorough handwritten-over-print flags", () => {
    for (const id of ["typed_pdf", "scanned_or_photo", "mcq_letter_key", "circled_mcq", "handwritten_open"] as const) {
      const mapped = mapPresetToReducto(id);
      assert.equal(mapped.agenticText, true);
      assert.equal(mapped.includeImages, true);
      assert.equal(mapped.intelligentOrdering, true);
      assert.equal(mapped.deepExtract, true);
      assert.equal(mapped.promptSuffix, UNIFIED_REDUCTO_MAPPING.promptSuffix);
    }
  });
});
