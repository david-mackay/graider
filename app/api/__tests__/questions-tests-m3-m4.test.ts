/**
 * M3 + M4 — questions & tests route contracts (incl. answer-key leakage).
 */
import { before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { actors, ids } from "./helpers/actors";
import {
  installL2Mocks,
  resetL2Mocks,
  scriptedDb,
  setActor,
  setClassRole,
} from "./helpers/l2-mocks";

installL2Mocks();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (...args: any[]) => Promise<Response>;

let questionsGET: AnyHandler;
let questionsPOST: AnyHandler;
let testsPOST: AnyHandler;
let testGET: AnyHandler;
let testPATCH: AnyHandler;

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function testRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.testA,
    classId: ids.classA,
    teacherId: actors.teacherA.id,
    title: "Quiz A",
    status: "open",
    opensAt: null,
    closesAt: null,
    durationMinutes: null,
    allowLateSubmit: false,
    gradesReleased: false,
    showAiFeedback: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("M3 questions + M4 tests L2", () => {
  before(async () => {
    installL2Mocks();
    ({ GET: questionsGET, POST: questionsPOST } = await import("@/app/api/questions/route"));
    ({ POST: testsPOST } = await import("@/app/api/tests/route"));
    ({ GET: testGET, PATCH: testPATCH } = await import("@/app/api/tests/[testId]/route"));
  });

  beforeEach(() => {
    resetL2Mocks();
  });

  it("Q-01 student GET/POST questions → 403", async () => {
    setActor(actors.studentA);
    const getRes = await questionsGET(
      new NextRequest(`http://localhost/api/questions?classId=${ids.classA}`),
    );
    assert.equal(getRes.status, 403);

    const postRes = await questionsPOST(
      jsonRequest("http://localhost/api/questions", {
        class_id: ids.classA,
        prompt: "Q?",
        correct_answer: "A",
        marks: 1,
      }),
    );
    assert.equal(postRes.status, 403);
  });

  it("Q-02 teacherB cannot mutate classA questions → 403", async () => {
    setActor(actors.teacherB);
    const res = await questionsPOST(
      jsonRequest("http://localhost/api/questions", {
        class_id: ids.classA,
        prompt: "Q?",
        correct_answer: "because",
        marks: 2,
        question_type: "open",
      }),
    );
    assert.equal(res.status, 403);
  });

  it("Q-05 teacherA can create open + mcq questions", async () => {
    setActor(actors.teacherA);
    setClassRole(ids.classA, "teacher");

    scriptedDb.insertReturning = [
      {
        id: ids.questionA,
        teacherId: actors.teacherA.id,
        classId: ids.classA,
        prompt: "Explain gravity",
        correctAnswer: "curvature",
        marks: 5,
        topic: null,
        questionType: "open",
        choices: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const openRes = await questionsPOST(
      jsonRequest("http://localhost/api/questions", {
        class_id: ids.classA,
        prompt: "Explain gravity",
        correct_answer: "curvature",
        marks: 5,
        question_type: "open",
      }),
    );
    assert.equal(openRes.status, 201);
    const openBody = await openRes.json();
    assert.equal(openBody.question.question_type, "open");

    scriptedDb.insertReturning = [
      {
        id: "q-mcq",
        teacherId: actors.teacherA.id,
        classId: ids.classA,
        prompt: "Pick one",
        correctAnswer: "B",
        marks: 1,
        topic: null,
        questionType: "mcq",
        choices: [
          { key: "A", text: "a" },
          { key: "B", text: "b" },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const mcqRes = await questionsPOST(
      jsonRequest("http://localhost/api/questions", {
        class_id: ids.classA,
        prompt: "Pick one",
        correct_answer: "B",
        marks: 1,
        question_type: "mcq",
        choices: [
          { key: "A", text: "a" },
          { key: "B", text: "b" },
        ],
      }),
    );
    assert.equal(mcqRes.status, 201);
    const mcqBody = await mcqRes.json();
    assert.equal(mcqBody.question.question_type, "mcq");
    assert.equal(mcqBody.question.correct_answer, "B");
  });

  it("T-01 student cannot create test → 403", async () => {
    setActor(actors.studentA);
    const res = await testsPOST(
      jsonRequest("http://localhost/api/tests", {
        title: "Hack",
        classId: ids.classA,
        questionIds: [ids.questionA],
      }),
    );
    assert.equal(res.status, 403);
  });

  it("T-02 teacherB cannot PATCH classA test → 403", async () => {
    setActor(actors.teacherB);
    scriptedDb.enqueueSelect([testRow()]);
    const res = await testPATCH(
      jsonRequest(`http://localhost/api/tests/${ids.testA}`, { title: "Nope" }, "PATCH"),
      { params: { testId: ids.testA } },
    );
    assert.equal(res.status, 403);
  });

  it("T-03 student GET test before open → 403", async () => {
    setActor(actors.studentA);
    scriptedDb.enqueueSelect(
      [testRow({ status: "draft" })],
      [{ role: "student" }],
      [], // no existing attempt
    );
    const res = await testGET(new Request("http://localhost/x"), {
      params: { testId: ids.testA },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /not available/i);
  });

  it("T-04 student GET test never includes correct_answer", async () => {
    setActor(actors.studentA);
    scriptedDb.enqueueSelect(
      [testRow({ status: "open" })],
      [{ role: "student" }],
      [
        {
          questionId: ids.questionA,
          sortOrder: 0,
          prompt: "Secret?",
          marks: 1,
          correctAnswer: "LEAK",
          questionType: "open",
          choices: null,
        },
      ],
    );
    const res = await testGET(new Request("http://localhost/x"), {
      params: { testId: ids.testA },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.test.questions.length, 1);
    assert.equal("correct_answer" in body.test.questions[0], false);
  });

  it("T-05 teacher GET includes correct_answer", async () => {
    setActor(actors.teacherA);
    setClassRole(ids.classA, "teacher");
    scriptedDb.enqueueSelect(
      [testRow()],
      [{ role: "teacher" }],
      [
        {
          questionId: ids.questionA,
          sortOrder: 0,
          prompt: "Secret?",
          marks: 1,
          correctAnswer: "KEY",
          questionType: "open",
          choices: null,
        },
      ],
    );
    const res = await testGET(new Request("http://localhost/x"), {
      params: { testId: ids.testA },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.test.questions[0].correct_answer, "KEY");
  });

  it("T-06 schedule / open_now only by class teacher", async () => {
    setActor(actors.teacherB);
    scriptedDb.enqueueSelect([testRow()]);
    const denied = await testPATCH(
      jsonRequest(
        `http://localhost/api/tests/${ids.testA}`,
        { action: "open_now" },
        "PATCH",
      ),
      { params: { testId: ids.testA } },
    );
    assert.equal(denied.status, 403);

    setActor(actors.teacherA);
    setClassRole(ids.classA, "teacher");
    const opened = testRow({ status: "open", opensAt: new Date() });
    scriptedDb.enqueueSelect([testRow({ status: "draft" })]);
    scriptedDb.updateReturning = [opened];
    const ok = await testPATCH(
      jsonRequest(
        `http://localhost/api/tests/${ids.testA}`,
        { action: "open_now" },
        "PATCH",
      ),
      { params: { testId: ids.testA } },
    );
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.test.status, "open");
  });

  it("T-07 teacher can reorder questions on a test", async () => {
    setActor(actors.teacherA);
    setClassRole(ids.classA, "teacher");
    const questionB = "question-bbbb-bbbb-bbbb-bbbbbbbb";
    scriptedDb.enqueueSelect(
      [testRow()],
      [{ questionId: ids.questionA }, { questionId: questionB }],
    );
    scriptedDb.updateReturning = [testRow()];
    const res = await testPATCH(
      jsonRequest(
        `http://localhost/api/tests/${ids.testA}`,
        { question_ids: [questionB, ids.questionA] },
        "PATCH",
      ),
      { params: { testId: ids.testA } },
    );
    assert.equal(res.status, 200);
  });

  it("T-08 reorder rejects a partial question list", async () => {
    setActor(actors.teacherA);
    setClassRole(ids.classA, "teacher");
    scriptedDb.enqueueSelect([testRow()], [{ questionId: ids.questionA }]);
    const res = await testPATCH(
      jsonRequest(
        `http://localhost/api/tests/${ids.testA}`,
        { question_ids: [] },
        "PATCH",
      ),
      { params: { testId: ids.testA } },
    );
    assert.equal(res.status, 400);
  });

  it("Q-06 / T-04 answer keys never on student-facing detail (alias)", async () => {
    // Covered by T-04; keep an explicit catalog alias assertion.
    setActor(actors.studentA);
    scriptedDb.enqueueSelect(
      [testRow()],
      [{ role: "student" }],
      [
        {
          questionId: "q1",
          sortOrder: 0,
          prompt: "MCQ",
          marks: 1,
          correctAnswer: "C",
          questionType: "mcq",
          choices: [{ key: "C", text: "c" }],
        },
      ],
    );
    const res = await testGET(new Request("http://localhost/x"), {
      params: { testId: ids.testA },
    });
    const body = await res.json();
    assert.equal(body.test.questions[0].correct_answer, undefined);
  });
});
