import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  citedString,
  unwrapCitedLeaf,
  LOW_PARSE_CONFIDENCE_THRESHOLD,
} from "@/lib/reducto-confidence";

describe("unwrapCitedLeaf", () => {
  it("passes plain strings through without flagging", () => {
    const leaf = unwrapCitedLeaf("Question 1");
    assert.equal(leaf.value, "Question 1");
    assert.equal(leaf.needsReview, false);
  });

  it("flags inferred values with empty citations", () => {
    const leaf = unwrapCitedLeaf({ value: "maybe B", citations: [] });
    assert.equal(leaf.value, "maybe B");
    assert.equal(leaf.needsReview, true);
  });

  it("flags a low citation band", () => {
    const leaf = unwrapCitedLeaf({
      value: "C",
      citations: [
        {
          confidence: "low",
          granular_confidence: { parse_confidence: 0.91, extract_confidence: 0.88 },
        },
      ],
    });
    assert.equal(leaf.needsReview, true);
    assert.equal(leaf.band, "low");
  });

  it("flags numeric parse confidence below the threshold", () => {
    const leaf = unwrapCitedLeaf({
      value: "the mitochondria",
      citations: [
        {
          confidence: "high",
          granular_confidence: {
            parse_confidence: LOW_PARSE_CONFIDENCE_THRESHOLD - 0.2,
            extract_confidence: 0.99,
          },
        },
      ],
    });
    assert.equal(leaf.needsReview, true);
    assert.equal(leaf.parseConfidence, LOW_PARSE_CONFIDENCE_THRESHOLD - 0.2);
  });

  it("keeps high-confidence grounded values", () => {
    const leaf = citedString({
      value: "  B  ",
      citations: [
        {
          confidence: "high",
          granular_confidence: { parse_confidence: 0.94, extract_confidence: 0.97 },
        },
      ],
    });
    assert.equal(leaf.text, "B");
    assert.equal(leaf.needsReview, false);
  });
});
