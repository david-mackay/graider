import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gradeAttributionForQuestionType } from "@/lib/grade-attribution";

describe("M6 grade-attribution (GR-08)", () => {
  it("GR-08 MCQ uses exact; open uses ai", () => {
    assert.equal(gradeAttributionForQuestionType("mcq"), "exact");
    assert.equal(gradeAttributionForQuestionType("open"), "ai");
    assert.equal(gradeAttributionForQuestionType(null), "ai");
  });
});
