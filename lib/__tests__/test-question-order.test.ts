import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isQuestionIdPermutation, parseQuestionIds } from "@/lib/test-question-order";

describe("test-question-order", () => {
  it("accepts a permutation of the same ids", () => {
    assert.equal(isQuestionIdPermutation(["a", "b", "c"], ["c", "a", "b"]), true);
  });

  it("rejects missing, extra, or duplicate ids", () => {
    assert.equal(isQuestionIdPermutation(["a", "b"], ["a"]), false);
    assert.equal(isQuestionIdPermutation(["a", "b"], ["a", "b", "c"]), false);
    assert.equal(isQuestionIdPermutation(["a", "b"], ["a", "a"]), false);
  });

  it("parses string id lists only", () => {
    assert.deepEqual(parseQuestionIds([" q1 ", "q2"]), ["q1", "q2"]);
    assert.equal(parseQuestionIds(["q1", 2]), null);
    assert.equal(parseQuestionIds("q1"), null);
  });
});
