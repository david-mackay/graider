/**
 * M5 L2 route contract tests — mocked auth + scripted db (no real Clerk/DB).
 * Requires: node --experimental-test-module-mocks
 */
import { before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { actors, ids } from "./helpers/actors";
import {
  clearClassRoles,
  installL2Mocks,
  resetL2Mocks,
  scriptedDb,
  setActor,
  setClassRole,
} from "./helpers/l2-mocks";

installL2Mocks();

// Route handlers vary in signature; keep assignments loose for the harness.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (...args: any[]) => Promise<Response>;

let startPOST: AnyHandler;
let submitPOST: AnyHandler;
let draftPATCH: AnyHandler;
let attemptGET: AnyHandler;
let gradePOST: AnyHandler;

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function openTest(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.testA,
    classId: ids.classA,
    teacherId: actors.teacherA.id,
    title: "Class A Quiz",
    status: "open",
    opensAt: null,
    closesAt: null,
    durationMinutes: null,
    allowLateSubmit: false,
    gradesReleased: true,
    showAiFeedback: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function draftAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.attemptA,
    testId: ids.testA,
    studentId: actors.studentA.id,
    source: "student",
    status: "draft",
    totalMarks: null,
    maxMarks: null,
    startedAt: new Date(),
    submittedAt: null,
    timedOutAt: null,
    gradedAt: null,
    ocrUploads: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("M5 submissions L2 routes", () => {
  before(async () => {
    installL2Mocks();
    ({ POST: startPOST } = await import("@/app/api/submissions/start/route"));
    ({ POST: submitPOST } = await import("@/app/api/submissions/route"));
    ({ PATCH: draftPATCH } = await import("@/app/api/submissions/[attemptId]/draft/route"));
    ({ GET: attemptGET } = await import("@/app/api/submissions/[attemptId]/route"));
    ({ POST: gradePOST } = await import("@/app/api/grade/route"));
  });

  beforeEach(() => {
    resetL2Mocks();
  });

  it("SUB-01 anon start/submit/draft → 401", async () => {
    setActor(null);

    const start = await startPOST(
      jsonRequest("http://localhost/api/submissions/start", { testId: ids.testA }),
    );
    assert.equal(start.status, 401);

    const submit = await submitPOST(
      jsonRequest("http://localhost/api/submissions", {
        testId: ids.testA,
        answers: [{ question_id: ids.questionA, answer: "A" }],
      }),
    );
    assert.equal(submit.status, 401);

    const draft = await draftPATCH(
      jsonRequest(
        `http://localhost/api/submissions/${ids.attemptA}/draft`,
        { answers: [{ question_id: ids.questionA, answer: "hi" }] },
        "PATCH",
      ),
      { params: { attemptId: ids.attemptA } },
    );
    assert.equal(draft.status, 401);
  });

  it("SUB-02 teacher cannot start student attempt → 403", async () => {
    setActor(actors.teacherA);
    const res = await startPOST(
      jsonRequest("http://localhost/api/submissions/start", { testId: ids.testA }),
    );
    assert.equal(res.status, 403);
  });

  it("SUB-03 studentB cannot start classA test → 403", async () => {
    setActor(actors.studentB);
    scriptedDb.enqueueSelect([openTest()], []); // test found, no membership
    const res = await startPOST(
      jsonRequest("http://localhost/api/submissions/start", { testId: ids.testA }),
    );
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /not enrolled/i);
  });

  it("SUB-05 submit without prior start → 400", async () => {
    setActor(actors.studentA);
    scriptedDb.enqueueSelect(
      [openTest()],
      [{ role: "student" }],
      [], // no attempt
    );
    const res = await submitPOST(
      jsonRequest("http://localhost/api/submissions", {
        testId: ids.testA,
        answers: [{ question_id: ids.questionA, answer: "A" }],
      }),
    );
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Start the test/i);
  });

  it("SUB-08 double submit → 409", async () => {
    setActor(actors.studentA);
    scriptedDb.enqueueSelect(
      [openTest()],
      [{ role: "student" }],
      [draftAttempt({ submittedAt: new Date(), status: "submitted" })],
    );
    const res = await submitPOST(
      jsonRequest("http://localhost/api/submissions", {
        testId: ids.testA,
        answers: [{ question_id: ids.questionA, answer: "A" }],
      }),
    );
    assert.equal(res.status, 409);
  });

  it("SUB-10 draft PATCH by other student → 403", async () => {
    setActor(actors.studentB);
    scriptedDb.enqueueSelect([
      {
        id: ids.attemptA,
        testId: ids.testA,
        studentId: actors.studentA.id,
        startedAt: new Date(),
        submittedAt: null,
        source: "student",
      },
    ]);
    const res = await draftPATCH(
      jsonRequest(
        `http://localhost/api/submissions/${ids.attemptA}/draft`,
        { answers: [{ question_id: ids.questionA, answer: "x" }] },
        "PATCH",
      ),
      { params: { attemptId: ids.attemptA } },
    );
    assert.equal(res.status, 403);
  });

  it("SUB-11 draft PATCH after submitted → 409", async () => {
    setActor(actors.studentA);
    scriptedDb.enqueueSelect([
      {
        id: ids.attemptA,
        testId: ids.testA,
        studentId: actors.studentA.id,
        startedAt: new Date(),
        submittedAt: new Date(),
        source: "student",
      },
    ]);
    const res = await draftPATCH(
      jsonRequest(
        `http://localhost/api/submissions/${ids.attemptA}/draft`,
        { answers: [{ question_id: ids.questionA, answer: "x" }] },
        "PATCH",
      ),
      { params: { attemptId: ids.attemptA } },
    );
    assert.equal(res.status, 409);
  });

  it("SUB-09 draft PATCH by owner while in window → 200", async () => {
    setActor(actors.studentA);
    scriptedDb.enqueueSelect(
      [
        {
          id: ids.attemptA,
          testId: ids.testA,
          studentId: actors.studentA.id,
          startedAt: new Date(),
          submittedAt: null,
          source: "student",
        },
      ],
      [openTest()],
      [{ questionId: ids.questionA }],
      [{ id: ids.attemptA }], // stillDraft inside txn
    );
    scriptedDb.transactionImpl = async (fn) => fn(scriptedDb.asDb());

    const res = await draftPATCH(
      jsonRequest(
        `http://localhost/api/submissions/${ids.attemptA}/draft`,
        { answers: [{ question_id: ids.questionA, answer: "draft answer" }] },
        "PATCH",
      ),
      { params: { attemptId: ids.attemptA } },
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.saved, true);
    assert.equal(body.answer_count, 1);
  });

  it("SUB-12 start resume returns saved draft answers", async () => {
    setActor(actors.studentA);
    const startedAt = new Date();
    scriptedDb.enqueueSelect(
      [openTest()],
      [{ role: "student" }],
      [draftAttempt({ startedAt, status: "draft" })],
      [{ questionId: ids.questionA, studentAnswer: "saved draft" }],
    );

    const res = await startPOST(
      jsonRequest("http://localhost/api/submissions/start", { testId: ids.testA }),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.resumed, true);
    assert.equal(body.attempt_id, ids.attemptA);
    assert.deepEqual(body.answers, [{ question_id: ids.questionA, answer: "saved draft" }]);
  });

  it("SUB-13 student cannot GET other student’s attempt → 403", async () => {
    setActor(actors.studentB);
    scriptedDb.enqueueSelect(
      [
        {
          id: ids.attemptA,
          testId: ids.testA,
          studentId: actors.studentA.id,
          status: "graded",
          totalMarks: 5,
          maxMarks: 5,
          ocrUploads: [],
          gradedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        {
          id: ids.testA,
          title: "Quiz",
          classId: ids.classA,
          gradesReleased: true,
          showAiFeedback: true,
        },
      ],
      [{ role: "student" }],
    );

    const res = await attemptGET(new Request("http://localhost/api/submissions/x"), {
      params: { attemptId: ids.attemptA },
    });
    assert.equal(res.status, 403);
  });

  it("SUB-14 student cannot GET own graded attempt before release → 403", async () => {
    setActor(actors.studentA);
    scriptedDb.enqueueSelect(
      [
        {
          id: ids.attemptA,
          testId: ids.testA,
          studentId: actors.studentA.id,
          status: "graded",
          totalMarks: 5,
          maxMarks: 5,
          ocrUploads: [],
          gradedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        {
          id: ids.testA,
          title: "Quiz",
          classId: ids.classA,
          gradesReleased: false,
          showAiFeedback: true,
        },
      ],
      [{ role: "student" }],
    );

    const res = await attemptGET(new Request("http://localhost/api/submissions/x"), {
      params: { attemptId: ids.attemptA },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /not yet available/i);
  });

  it("SUB-15 teacher cannot grade unsubmitted attempt → 409", async () => {
    setActor(actors.teacherA);
    scriptedDb.enqueueSelect([
      { id: ids.attemptA, testId: ids.testA, submittedAt: null },
    ]);
    const res = await gradePOST(
      jsonRequest("http://localhost/api/grade", { attemptId: ids.attemptA }),
    );
    assert.equal(res.status, 409);
  });

  it("SUB-16 teacherB cannot grade classA attempt → 403", async () => {
    setActor(actors.teacherB);
    clearClassRoles();
    scriptedDb.enqueueSelect(
      [{ id: ids.attemptA, testId: ids.testA, submittedAt: new Date() }],
      [{ id: ids.testA, classId: ids.classA }],
    );
    const res = await gradePOST(
      jsonRequest("http://localhost/api/grade", { attemptId: ids.attemptA }),
    );
    assert.equal(res.status, 403);
  });

  it("teacherA can grade submitted classA attempt past authz gates", async () => {
    setActor(actors.teacherA);
    setClassRole(ids.classA, "teacher");
    scriptedDb.enqueueSelect(
      [{ id: ids.attemptA, testId: ids.testA, submittedAt: new Date() }],
      [{ id: ids.testA, classId: ids.classA }],
    );
    const res = await gradePOST(
      jsonRequest("http://localhost/api/grade", { attemptId: ids.attemptA }),
    );
    assert.equal(res.status, 200);
  });
});
