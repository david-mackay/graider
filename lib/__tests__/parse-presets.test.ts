import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  coerceParsePreset,
  defaultPresetForSurface,
  isDocumentParsePreset,
  mapPresetToReducto,
  presetsForSurface,
} from "@/lib/parse-presets";

describe("parse-presets", () => {
  it("validates and defaults presets", () => {
    assert.equal(isDocumentParsePreset("circled_mcq"), true);
    assert.equal(isDocumentParsePreset("nope"), false);
    assert.equal(defaultPresetForSurface("grade_stack"), "handwritten_open");
    assert.equal(coerceParsePreset("typed_pdf", "student_ocr"), "typed_pdf");
    assert.equal(coerceParsePreset("garbage", "student_ocr"), "handwritten_open");
    assert.equal(coerceParsePreset("circled_mcq", "student_ocr"), "handwritten_open");
    assert.equal(coerceParsePreset("mcq_letter_key", "grade_stack"), "handwritten_open");
    assert.equal(presetsForSurface("grade_stack").some((option) => option.id === "circled_mcq"), false);
    assert.equal(presetsForSurface("student_ocr").some((option) => option.id === "mcq_letter_key"), false);
  });

  it("maps presets to reducto flags", () => {
    const typed = mapPresetToReducto("typed_pdf");
    assert.equal(typed.agenticText, false);
    const circled = mapPresetToReducto("circled_mcq");
    assert.equal(circled.agenticText, true);
    assert.equal(circled.includeImages, true);
  });
});
