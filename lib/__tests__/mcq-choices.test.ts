import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isMcqQuestion, resolveMcqChoices } from "@/lib/mcq-choices";

describe("mcq-choices", () => {
  it("returns null for open questions", () => {
    assert.equal(resolveMcqChoices({ prompt: "Explain gravity", question_type: "open" }), null);
    assert.equal(isMcqQuestion({ question_type: "open" }), false);
  });

  it("prefers stored choices", () => {
    const choices = resolveMcqChoices({
      prompt: "Pick one",
      question_type: "mcq",
      choices: [
        { key: "a", text: " Alpha " },
        { key: "B", text: "" },
      ],
    });
    assert.deepEqual(choices, [
      { key: "A", text: "Alpha" },
      { key: "B", text: "B" },
    ]);
  });

  it("parses choices from prompt when missing", () => {
    const choices = resolveMcqChoices({
      prompt: "Q\nA. Red\nB. Blue\nC. Green",
      question_type: "mcq",
      choices: null,
    });
    assert.ok(choices);
    assert.equal(choices!.length >= 2, true);
    assert.equal(choices![0].key, "A");
  });

  it("falls back to A–E letters", () => {
    const choices = resolveMcqChoices({
      prompt: "Just a stem with no options",
      question_type: "mcq",
    });
    assert.deepEqual(
      choices?.map((c) => c.key),
      ["A", "B", "C", "D", "E"],
    );
  });
});
