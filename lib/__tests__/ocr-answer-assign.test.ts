import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assignOcrAnswersToKeys } from "@/lib/ocr-answer-assign";

describe("assignOcrAnswersToKeys", () => {
  it("maps unique 1-based indexes", () => {
    const assigned = assignOcrAnswersToKeys(
      [
        { answer: "Paris", question_index: 2 },
        { answer: "4", question_index: 1 },
      ],
      2,
    );
    assert.deepEqual(assigned, ["4", "Paris"]);
  });

  it("zips by order when every row shares the same question_index", () => {
    const assigned = assignOcrAnswersToKeys(
      [
        { answer: "first", question_index: 1 },
        { answer: "second", question_index: 1 },
        { answer: "third", question_index: 1 },
      ],
      3,
    );
    assert.deepEqual(assigned, ["first", "second", "third"]);
  });
});
