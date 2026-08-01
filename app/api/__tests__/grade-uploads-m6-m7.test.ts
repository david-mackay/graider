/**
 * M6 + M7 — grade authz / job IDOR / upload signing access.
 */
import { before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { actors, ids } from "./helpers/actors";
import {
  installL2Mocks,
  l2Stubs,
  resetL2Mocks,
  scriptedDb,
  setActor,
  setClassRole,
} from "./helpers/l2-mocks";

installL2Mocks();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (...args: any[]) => Promise<Response>;

let gradePOST: AnyHandler;
let jobGET: AnyHandler;
let uploadSignPOST: AnyHandler;
let uploadGET: AnyHandler;

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("M6 grade + M7 uploads L2", () => {
  before(async () => {
    installL2Mocks();
    ({ POST: gradePOST } = await import("@/app/api/grade/route"));
    ({ GET: jobGET } = await import("@/app/api/grade-stack/jobs/[jobId]/route"));
    ({ POST: uploadSignPOST } = await import("@/app/api/uploads/sign/route"));
    ({ GET: uploadGET } = await import("@/app/api/uploads/[...segments]/route"));
  });

  beforeEach(() => {
    resetL2Mocks();
  });

  it("GR-01 student cannot POST /api/grade → 403", async () => {
    setActor(actors.studentA);
    const res = await gradePOST(
      jsonRequest("http://localhost/api/grade", { attemptId: ids.attemptA }),
    );
    assert.equal(res.status, 403);
  });

  it("GR-02 teacherB cannot grade classA → 403", async () => {
    setActor(actors.teacherB);
    scriptedDb.enqueueSelect(
      [{ id: ids.attemptA, testId: ids.testA, submittedAt: new Date() }],
      [{ id: ids.testA, classId: ids.classA }],
    );
    const res = await gradePOST(
      jsonRequest("http://localhost/api/grade", { attemptId: ids.attemptA }),
    );
    assert.equal(res.status, 403);
  });

  it("GR-07 grade-stack job GET must not leak other teachers’ jobs", async () => {
    l2Stubs.jobsById.set("job-a", {
      id: "job-a",
      teacherId: actors.teacherA.id,
      status: "completed",
      classId: ids.classA,
    });

    setActor(actors.teacherB);
    const denied = await jobGET(new NextRequest("http://localhost/x"), {
      params: Promise.resolve({ jobId: "job-a" }),
    });
    assert.equal(denied.status, 403);

    setActor(actors.teacherA);
    const ok = await jobGET(new NextRequest("http://localhost/x"), {
      params: Promise.resolve({ jobId: "job-a" }),
    });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.id, "job-a");
  });

  it("UP-01 student cannot sign upload → 403", async () => {
    setActor(actors.studentA);
    const res = await uploadSignPOST(
      jsonRequest("http://localhost/api/uploads/sign", {
        purpose: "stack_preview",
        testId: ids.testA,
        files: [{ filename: "a.jpg", contentType: "image/jpeg", size: 100 }],
      }),
    );
    assert.equal(res.status, 403);
  });

  it("UP-02 teacherB cannot sign for classA test → 403", async () => {
    setActor(actors.teacherB);
    scriptedDb.enqueueSelect([{ id: ids.testA, classId: ids.classA }]);
    const res = await uploadSignPOST(
      jsonRequest("http://localhost/api/uploads/sign", {
        purpose: "stack_preview",
        testId: ids.testA,
        files: [{ filename: "a.jpg", contentType: "image/jpeg", size: 100 }],
      }),
    );
    assert.equal(res.status, 403);
  });

  it("UP-05 GET upload requires class/job access", async () => {
    const pathSegments = ["stack-preview", ids.testA, "page.jpg"];

    setActor(actors.teacherB);
    scriptedDb.enqueueSelect([]); // no test match by id? wait - authorize looks up test by uploadKey
    // First select: test by id → found with classA, then requireClassAccess fails
    scriptedDb.reset();
    scriptedDb.enqueueSelect([{ classId: ids.classA }]);
    const denied = await uploadGET(new Request("http://localhost/x"), {
      params: { segments: pathSegments },
    });
    assert.equal(denied.status, 403);

    setActor(actors.teacherA);
    setClassRole(ids.classA, "teacher");
    scriptedDb.enqueueSelect([{ classId: ids.classA }]);
    const ok = await uploadGET(new Request("http://localhost/x"), {
      params: { segments: pathSegments },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("content-type"), "image/jpeg");
  });

  it("teacherA can sign upload for own class test", async () => {
    setActor(actors.teacherA);
    setClassRole(ids.classA, "teacher");
    scriptedDb.enqueueSelect([{ id: ids.testA, classId: ids.classA }]);
    const res = await uploadSignPOST(
      jsonRequest("http://localhost/api/uploads/sign", {
        purpose: "stack_preview",
        testId: ids.testA,
        files: [{ filename: "a.jpg", contentType: "image/jpeg", size: 100 }],
      }),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.uploads.length, 1);
    assert.match(body.uploads[0].path, new RegExp(`stack-preview/${ids.testA}/`));
  });
});
