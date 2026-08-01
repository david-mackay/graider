import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  coerceParsePreset,
  defaultPresetForSurface,
  isDocumentParsePreset,
  mapPresetToReducto,
} from "@/lib/parse-presets";

describe("parse-presets", () => {
  it("validates and defaults presets", () => {
    assert.equal(isDocumentParsePreset("circled_mcq"), true);
    assert.equal(isDocumentParsePreset("nope"), false);
    assert.equal(defaultPresetForSurface("grade_stack"), "circled_mcq");
    assert.equal(coerceParsePreset("typed_pdf", "student_ocr"), "typed_pdf");
    assert.equal(coerceParsePreset("garbage", "student_ocr"), "circled_mcq");
  });

  it("maps presets to reducto flags", () => {
    const typed = mapPresetToReducto("typed_pdf");
    assert.equal(typed.agenticText, false);
    const circled = mapPresetToReducto("circled_mcq");
    assert.equal(circled.agenticText, true);
    assert.equal(circled.includeImages, true);
  });
});
