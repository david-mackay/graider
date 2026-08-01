import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchOcrAnswersToQuestions, normalizeQuestion } from "@/lib/stack-grading";

describe("stack-grading matchOcrAnswersToQuestions", () => {
  const questions = [
    { questionId: "q1", prompt: "What is 2+2?" },
    { questionId: "q2", prompt: "Capital of France?" },
  ];

  it("matches by normalized prompt", () => {
    const rows = matchOcrAnswersToQuestions(
      [{ question: "what is 2+2", answer: "4" }],
      questions,
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].questionId, "q1");
    assert.equal(rows[0].studentAnswer, "4");
  });

  it("matches by 1-based question_index", () => {
    const rows = matchOcrAnswersToQuestions(
      [{ question: "unclear", answer: "Paris", question_index: 2 }],
      questions,
    );
    assert.equal(rows[0]?.questionId, "q2");
  });

  it("falls back to positional when counts align", () => {
    const rows = matchOcrAnswersToQuestions(
      [
        { question: "???", answer: "4" },
        { question: "???", answer: "Paris" },
      ],
      questions,
    );
    assert.equal(rows.length, 2);
  });

  it("normalizeQuestion strips punctuation", () => {
    assert.equal(normalizeQuestion(" Hello, World! "), "hello world");
  });
});
