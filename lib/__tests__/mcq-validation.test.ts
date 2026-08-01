import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeMcqChoices, validateMcqAnswerKey } from "@/lib/mcq-validation";

describe("M3 mcq-validation (Q-03 Q-04)", () => {
  it("Q-03 rejects non A–E answer keys", () => {
    const gate = validateMcqAnswerKey({ correctAnswer: "yes" });
    assert.equal(gate.ok, false);
  });

  it("Q-04 rejects key not in choices", () => {
    const choices = normalizeMcqChoices([
      { key: "A", text: "One" },
      { key: "B", text: "Two" },
    ]);
    const gate = validateMcqAnswerKey({ correctAnswer: "C", choices });
    assert.equal(gate.ok, false);
  });

  it("accepts valid letter in choices", () => {
    const choices = normalizeMcqChoices([
      { key: "a", text: "One" },
      { key: "b", text: "Two" },
    ]);
    const gate = validateMcqAnswerKey({ correctAnswer: "B", choices });
    assert.equal(gate.ok, true);
    if (gate.ok) assert.equal(gate.letter, "B");
  });

  it("accepts letter with no choices list", () => {
    const gate = validateMcqAnswerKey({ correctAnswer: "(D)" });
    assert.equal(gate.ok, true);
    if (gate.ok) assert.equal(gate.letter, "D");
  });
});
