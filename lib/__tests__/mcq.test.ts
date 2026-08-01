import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assessPdfText,
  coerceChoices,
  coerceQuestionType,
  deriveTestQuestionMix,
  gradeMcqExact,
  normalizeMcqLetter,
} from "@/lib/mcq";

describe("M0.2 mcq", () => {
  it("MCQ-01 normalizes common letter forms", () => {
    assert.equal(normalizeMcqLetter("B"), "B");
    assert.equal(normalizeMcqLetter("b"), "B");
    assert.equal(normalizeMcqLetter("(B)"), "B");
    assert.equal(normalizeMcqLetter("B."), "B");
    assert.equal(normalizeMcqLetter("option B"), "B");
    assert.equal(normalizeMcqLetter("Answer: C"), "C");
  });

  it("MCQ-02 rejects empty or unparseable noise", () => {
    assert.equal(normalizeMcqLetter(""), null);
    assert.equal(normalizeMcqLetter("   "), null);
    assert.equal(normalizeMcqLetter("this is a long sentence without a clear choice marker at all"), null);
  });

  it("MCQ-03 exact match awards full marks without leaking key beyond Correct", () => {
    const grade = gradeMcqExact({ teacherAnswer: "B", studentAnswer: "b", marks: 2 });
    assert.equal(grade.marks_earned, 2);
    assert.equal(grade.feedback, "Correct");
    assert.equal(grade.feedback.includes("Expected"), false);
  });

  it("MCQ-04 wrong letter is Incorrect without revealing key", () => {
    const grade = gradeMcqExact({ teacherAnswer: "B", studentAnswer: "A", marks: 2 });
    assert.equal(grade.marks_earned, 0);
    assert.equal(grade.feedback, "Incorrect");
    assert.equal(grade.feedback.includes("B"), false);
    assert.equal(grade.feedback.includes("Expected"), false);
  });

  it("MCQ-05 missing answer key letter", () => {
    const grade = gradeMcqExact({ teacherAnswer: "not-a-letter", studentAnswer: "A", marks: 1 });
    assert.equal(grade.marks_earned, 0);
    assert.match(grade.feedback, /Answer key letter is missing/i);
  });

  it("MCQ-06 empty student answer does not leak key", () => {
    const grade = gradeMcqExact({ teacherAnswer: "C", studentAnswer: "", marks: 1 });
    assert.equal(grade.marks_earned, 0);
    assert.equal(grade.feedback.includes("C"), false);
    assert.match(grade.feedback, /Incorrect/i);
  });

  it("MCQ-07 coerce helpers and mix derivation", () => {
    assert.equal(coerceQuestionType("mcq"), "mcq");
    assert.equal(coerceQuestionType("open"), "open");
    assert.equal(coerceQuestionType("nope"), "open");

    const choices = coerceChoices([
      { key: "a", text: "Alpha" },
      { letter: "B", text: "Beta" },
      { key: "Z", text: "bad" },
    ]);
    assert.ok(choices);
    assert.equal(choices![0].key, "A");
    assert.equal(choices!.some((c) => c.key === "B"), true);

    assert.equal(deriveTestQuestionMix(["mcq", "mcq"]), "mcq");
    assert.equal(deriveTestQuestionMix(["open"]), "open");
    assert.equal(deriveTestQuestionMix(["open", "mcq"]), "mixed");
    assert.equal(deriveTestQuestionMix([]), "open");
  });

  it("assessPdfText rejects sparse OCR noise", () => {
    assert.equal(assessPdfText("!!!").usable, false);
    const rich = "A".repeat(50) + " " + "word ".repeat(20);
    assert.equal(assessPdfText(rich).usable, true);
  });
});
