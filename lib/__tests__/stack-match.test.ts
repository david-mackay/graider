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

  it("merges multiple OCR rows that share a printed question number", () => {
    const questions = [
      { questionId: "q1", prompt: "Define any three of the following" },
      { questionId: "q2", prompt: "List two ways to prevent exposure" },
    ];
    const rows = matchOcrAnswersToQuestions(
      [
        { question: "abandonment", answer: "leaving a patient", question_index: 1 },
        { question: "assault", answer: "threat of harm", question_index: 1 },
        { question: "battery", answer: "unlawful touching", question_index: 1 },
        { question: "Q2", answer: "PPE and hand washing", question_index: 2 },
      ],
      questions,
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].questionId, "q1");
    assert.match(rows[0].studentAnswer, /leaving a patient/);
    assert.match(rows[0].studentAnswer, /unlawful touching/);
    assert.equal(rows[1].questionId, "q2");
    assert.equal(rows[1].studentAnswer, "PPE and hand washing");
  });

  it("does not treat same-number fragments as later questions", () => {
    const questions = [
      { questionId: "q1", prompt: "Define any three of the following" },
      { questionId: "q2", prompt: "List two ways to prevent exposure" },
      { questionId: "q3", prompt: "What are the four levels of EMS Training" },
      { questionId: "q4", prompt: "List any 4 responsibilities of the EMT" },
    ];
    const rows = matchOcrAnswersToQuestions(
      [
        { question: "abandonment", answer: "leaving a patient", question_index: 1 },
        { question: "assault", answer: "threat of harm", question_index: 1 },
        { question: "battery", answer: "unlawful touching", question_index: 1 },
        { question: "libel", answer: "written defamation", question_index: 1 },
        { question: "unclear", answer: "PPE and hand washing", question_index: 2 },
        { question: "unclear", answer: "EMR EMT AEMT Paramedic", question_index: 3 },
        { question: "unclear", answer: "scene safety patient care", question_index: 4 },
      ],
      questions,
    );
    assert.equal(rows.length, 4);
    assert.equal(rows[0].questionId, "q1");
    assert.match(rows[0].studentAnswer, /leaving a patient/);
    assert.match(rows[0].studentAnswer, /written defamation/);
    assert.equal(rows[1].studentAnswer, "PPE and hand washing");
    assert.equal(rows[2].studentAnswer, "EMR EMT AEMT Paramedic");
    assert.equal(rows[3].studentAnswer, "scene safety patient care");
  });

  it("normalizeQuestion strips punctuation", () => {
    assert.equal(normalizeQuestion(" Hello, World! "), "hello world");
  });
});

describe("buildStudentFirstPreviewPages storage paths", () => {
  it("binds files by upload order even when OCR repeats pageIndex 0", async () => {
    const { buildStudentFirstPreviewPages } = await import("@/lib/stack-grading");
    const pages = buildStudentFirstPreviewPages({
      ocrPages: [
        { pageIndex: 0, studentNameGuess: "", confidence: 0, answers: [] },
        { pageIndex: 0, studentNameGuess: "", confidence: 0, answers: [] },
        { pageIndex: 0, studentNameGuess: "", confidence: 0, answers: [] },
      ],
      storagePaths: ["stack-preview/t/a.png", "stack-preview/t/b.png", "stack-preview/t/c.png"],
    });
    assert.deepEqual(
      pages.map((page) => page.storagePath),
      ["stack-preview/t/a.png", "stack-preview/t/b.png", "stack-preview/t/c.png"],
    );
  });
});
