import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPrintedQuestionNumber,
  parsePrintedQuestionNumber,
} from "@/lib/question-index";

describe("printed question numbers", () => {
  it("shows 1-based OCR indexes as printed numbers", () => {
    assert.equal(formatPrintedQuestionNumber(1), "1");
    assert.equal(formatPrintedQuestionNumber(2), "2");
  });

  it("shows legacy 0-based values as question 1", () => {
    assert.equal(formatPrintedQuestionNumber(0), "1");
  });

  it("stores the number the teacher types", () => {
    assert.equal(parsePrintedQuestionNumber("1"), 1);
    assert.equal(parsePrintedQuestionNumber("12"), 12);
    assert.equal(parsePrintedQuestionNumber(""), null);
  });
});
