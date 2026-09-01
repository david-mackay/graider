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
    const byId = Object.fromEntries(rows.map((row) => [row.questionId, row.studentAnswer]));
    assert.equal(rows.length, 2);
    assert.match(byId.q1, /leaving a patient/);
    assert.match(byId.q1, /unlawful touching/);
    assert.equal(byId.q2, "PPE and hand washing");
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

  it("zips by order when OCR stamps every row with the same question_index", () => {
    const questions = [
      { questionId: "q1", prompt: "Q1" },
      { questionId: "q2", prompt: "Q2" },
      { questionId: "q3", prompt: "Q3" },
    ];
    const rows = matchOcrAnswersToQuestions(
      [
        { question: "unclear", answer: "alpha", question_index: 1 },
        { question: "unclear", answer: "beta", question_index: 1 },
        { question: "unclear", answer: "gamma", question_index: 1 },
      ],
      questions,
    );
    assert.deepEqual(
      rows.map((row) => row.studentAnswer),
      ["alpha", "beta", "gamma"],
    );
  });

  it("does not merge a later question into Q1 when the stem matches Q21", () => {
    const questions = [
      { questionId: "q1", prompt: "Define any three of the following", correctAnswer: "Scope of practice" },
      { questionId: "q2", prompt: "List two ways to prevent exposure", correctAnswer: "PPE" },
      {
        questionId: "q21",
        prompt:
          "You are dispatched to a residence for an unconscious man in the front yard. Describe in SEQUENTIAL ORDER how you would manage this patient",
        correctAnswer: "Scene Size up – 6 marks. Primary Assessment – 26 marks.",
      },
    ];
    const rows = matchOcrAnswersToQuestions(
      [
        { question: "abandonment", answer: "leaving a patient without consent", question_index: 1 },
        {
          question:
            "You are dispatched to a residence for an unconscious man in the front yard. Describe in SEQUENTIAL ORDER how you would manage this patient",
          answer: "BSI, scene safety, then primary assessment",
          question_index: 1,
        },
      ],
      questions,
    );
    const byId = Object.fromEntries(rows.map((row) => [row.questionId, row.studentAnswer]));
    assert.match(byId.q1, /leaving a patient/);
    assert.equal(byId.q1.includes("primary assessment"), false);
    assert.match(byId.q21, /primary assessment/);
  });

  it("splits a concatenated Q1 answer when the tail belongs to the last question", () => {
    const questions = [
      {
        questionId: "q1",
        prompt: "Define any three of the following",
        correctAnswer: "Scope of practice, negligence, abandonment",
      },
      {
        questionId: "q21",
        prompt: "Describe in sequential order how you would manage this patient",
        correctAnswer: "Scene Size up – 6 marks\nPrimary Assessment – 26 marks",
      },
    ];
    const rows = matchOcrAnswersToQuestions(
      [
        {
          question: "Define any three of the following",
          answer:
            "Scope of practice: what an EMT is allowed to do. Negligence: failure to act.\n\n(1) Scene size up – PPE, scene safety, then ALS.",
          question_index: 1,
        },
      ],
      questions,
    );
    const byId = Object.fromEntries(rows.map((row) => [row.questionId, row.studentAnswer]));
    assert.match(byId.q1, /Scope of practice/);
    assert.equal(/scene size up/i.test(byId.q1), false);
    assert.match(byId.q21, /Scene size up/i);
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
