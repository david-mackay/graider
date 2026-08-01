/**
 * M2 L2 — classes / join / invites / roster route contracts.
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

let classesGET: AnyHandler;
let classesPOST: AnyHandler;
let classPATCH: AnyHandler;
let joinPOST: AnyHandler;
let inviteGET: AnyHandler;
let invitePOST: AnyHandler;
let inviteDELETE: AnyHandler;
let rosterGET: AnyHandler;
let studentsPOST: AnyHandler;
let studentPATCH: AnyHandler;
let studentDELETE: AnyHandler;

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const classParams = { params: { classId: ids.classA } };

describe("M2 classes / invites / roster L2 routes", () => {
  before(async () => {
    installL2Mocks();
    ({ GET: classesGET, POST: classesPOST } = await import("@/app/api/classes/route"));
    ({ PATCH: classPATCH } = await import("@/app/api/classes/[classId]/route"));
    ({ POST: joinPOST } = await import("@/app/api/classes/join/route"));
    ({ GET: inviteGET, POST: invitePOST, DELETE: inviteDELETE } = await import(
      "@/app/api/classes/[classId]/invite/route"
    ));
    ({ GET: rosterGET } = await import("@/app/api/classes/[classId]/roster/route"));
    ({ POST: studentsPOST } = await import("@/app/api/classes/[classId]/students/route"));
    ({ PATCH: studentPATCH, DELETE: studentDELETE } = await import(
      "@/app/api/classes/[classId]/students/[studentId]/route"
    ));
  });

  beforeEach(() => {
    resetL2Mocks();
  });

  it("CL-01 anon GET → 401", async () => {
    setActor(null);
    const res = await classesGET();
    assert.equal(res.status, 401);
  });

  it("CL-02 member sees only own classes", async () => {
    setActor(actors.studentA);
    l2Stubs.listedClasses = [
      {
        id: ids.classA,
        name: "Class A",
        owner_user_id: actors.teacherA.id,
        invite_code: "AAAA",
        role_in_class: "student",
        student_count: 1,
      },
    ];
    const res = await classesGET();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.classes.length, 1);
    assert.equal(body.classes[0].id, ids.classA);
  });

  it("CL-03 student POST create → 403", async () => {
    setActor(actors.studentA);
    const res = await classesPOST(
      jsonRequest("http://localhost/api/classes", { name: "Hacked class" }),
    );
    assert.equal(res.status, 403);
  });

  it("CL-04 teacher POST create → 201", async () => {
    setActor(actors.teacherA);
    const now = new Date();
    scriptedDb.insertReturning = [
      {
        id: ids.classA,
        name: "Period 1",
        ownerUserId: actors.teacherA.id,
        inviteCode: "ABC123",
        createdAt: now,
        updatedAt: now,
      },
    ];
    const res = await classesPOST(
      jsonRequest("http://localhost/api/classes", { name: "Period 1" }),
    );
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.class.name, "Period 1");
    assert.equal(body.class.role_in_class, "teacher");
  });

  it("CL-05 teacherB cannot rename classA → 403", async () => {
    setActor(actors.teacherB);
    // no class role for classA
    const res = await classPATCH(
      jsonRequest(`http://localhost/api/classes/${ids.classA}`, { name: "Nope" }, "PATCH"),
      classParams,
    );
    assert.equal(res.status, 403);
  });

  it("CL-06 teacherA can rename classA", async () => {
    setActor(actors.teacherA);
    setClassRole(ids.classA, "teacher");
    const now = new Date();
    scriptedDb.updateReturning = [
      {
        id: ids.classA,
        name: "Renamed",
        ownerUserId: actors.teacherA.id,
        inviteCode: "ABC123",
        createdAt: now,
        updatedAt: now,
      },
    ];
    const res = await classPATCH(
      jsonRequest(`http://localhost/api/classes/${ids.classA}`, { name: "Renamed" }, "PATCH"),
      classParams,
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.class.name, "Renamed");
  });

  it("JOIN-01 anon → 401", async () => {
    setActor(null);
    const res = await joinPOST(
      jsonRequest("http://localhost/api/classes/join", { inviteCode: "ABC" }),
    );
    assert.equal(res.status, 401);
  });

  it("INV-01 student cannot create invite → 403", async () => {
    setActor(actors.studentA);
    const res = await invitePOST(
      jsonRequest(`http://localhost/api/classes/${ids.classA}/invite`, {
        invited_name: "Kid",
        role: "student",
      }),
      classParams,
    );
    assert.equal(res.status, 403);
  });

  it("INV-02 teacherB cannot invite into classA → 403", async () => {
    setActor(actors.teacherB);
    const res = await invitePOST(
      jsonRequest(`http://localhost/api/classes/${ids.classA}/invite`, {
        invited_name: "Kid",
        role: "student",
      }),
      classParams,
    );
    assert.equal(res.status, 403);
  });

  it("INV-04 teacher can list/revoke own class invites", async () => {
    setActor(actors.teacherA);
    setClassRole(ids.classA, "teacher");
    scriptedDb.enqueueSelect([
      {
        id: "inv-1",
        code: "CODE1",
        role: "student",
        status: "pending",
        invitedEmail: null,
        invitedName: "Kid",
        expiresAt: null,
        createdAt: new Date(),
        studentId: null,
        singleUse: true,
        acceptedByName: null,
      },
    ]);
    const list = await inviteGET(new Request("http://localhost/x"), classParams);
    assert.equal(list.status, 200);
    const listed = await list.json();
    assert.equal(listed.invitations.length, 1);
    assert.equal(listed.invitations[0].code, "CODE1");

    scriptedDb.enqueueSelect([{ id: "inv-1" }]);
    const revoked = await inviteDELETE(
      jsonRequest(
        `http://localhost/api/classes/${ids.classA}/invite`,
        { invitationId: "inv-1" },
        "DELETE",
      ),
      classParams,
    );
    assert.equal(revoked.status, 200);
    const body = await revoked.json();
    assert.equal(body.success, true);
  });

  it("ROST-01 student cannot read roster → 403", async () => {
    setActor(actors.studentA);
    setClassRole(ids.classA, "student");
    const res = await rosterGET(new Request("http://localhost/x"), classParams);
    assert.equal(res.status, 403);
  });

  it("ROST-02 teacherB cannot read classA roster → 403", async () => {
    setActor(actors.teacherB);
    const res = await rosterGET(new Request("http://localhost/x"), classParams);
    assert.equal(res.status, 403);
  });

  it("ROST-03 teacherA can create roster student", async () => {
    setActor(actors.teacherA);
    setClassRole(ids.classA, "teacher");
    const res = await studentsPOST(
      jsonRequest(`http://localhost/api/classes/${ids.classA}/students`, {
        full_name: "Roster Kid",
        email: "kid@school.test",
      }),
      classParams,
    );
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.student.full_name, "Roster Kid");
    assert.ok(String(body.student.user_id).startsWith("roster_"));
  });

  it("ROST-04 cannot PATCH Clerk-backed student profile via roster update", async () => {
    setActor(actors.teacherA);
    setClassRole(ids.classA, "teacher");
    scriptedDb.enqueueSelect([{ userId: actors.studentA.id }]); // in class
    const res = await studentPATCH(
      jsonRequest(
        `http://localhost/api/classes/${ids.classA}/students/${actors.studentA.id}`,
        { full_name: "Hacked" },
        "PATCH",
      ),
      { params: { classId: ids.classA, studentId: actors.studentA.id } },
    );
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Signed-in student profiles/i);
  });

  it("ROST-05 teacherA can delete roster student", async () => {
    setActor(actors.teacherA);
    setClassRole(ids.classA, "teacher");
    const rosterId = "roster_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    scriptedDb.enqueueSelect(
      [{ userId: rosterId }], // assertStudentInClass
      [], // no remaining memberships → delete app user
    );
    const res = await studentDELETE(new Request("http://localhost/x"), {
      params: { classId: ids.classA, studentId: rosterId },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.removed, true);
  });
});
