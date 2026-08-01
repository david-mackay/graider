/**
 * M1 L2 — /api/me/* route contracts (mocked auth/db/side effects).
 */
import { before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { actors } from "./helpers/actors";
import {
  installL2Mocks,
  l2Stubs,
  resetL2Mocks,
  scriptedDb,
  setActor,
} from "./helpers/l2-mocks";

installL2Mocks();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (...args: any[]) => Promise<Response>;

let roleGET: AnyHandler;
let rolePOST: AnyHandler;
let profilePATCH: AnyHandler;
let subscriptionGET: AnyHandler;
let meDELETE: AnyHandler;

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("M1 me L2 routes", () => {
  before(async () => {
    installL2Mocks();
    ({ GET: roleGET, POST: rolePOST } = await import("@/app/api/me/role/route"));
    ({ PATCH: profilePATCH } = await import("@/app/api/me/profile/route"));
    ({ GET: subscriptionGET } = await import("@/app/api/me/subscription/route"));
    ({ DELETE: meDELETE } = await import("@/app/api/me/route"));
  });

  beforeEach(() => {
    resetL2Mocks();
  });

  it("ME-ROLE-01 anon → 401", async () => {
    setActor(null);
    const getRes = await roleGET();
    assert.equal(getRes.status, 401);
    const postRes = await rolePOST(
      jsonRequest("http://localhost/api/me/role", { role: "teacher" }),
    );
    assert.equal(postRes.status, 401);
  });

  it("ME-ROLE-05 GET returns current user", async () => {
    setActor(actors.studentA);
    const res = await roleGET();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.id, actors.studentA.id);
    assert.equal(body.user.role, "student");
  });

  it("ME-ROLE-03 student with membership cannot become teacher → 403", async () => {
    setActor(actors.studentA);
    scriptedDb.enqueueSelect([{ id: "mem-1" }]);
    const res = await rolePOST(
      jsonRequest("http://localhost/api/me/role", { role: "teacher" }),
    );
    assert.equal(res.status, 403);
  });

  it("ME-PROF-01 anon → 401", async () => {
    setActor(null);
    const res = await profilePATCH(
      jsonRequest("http://localhost/api/me/profile", { full_name: "Ada" }, "PATCH"),
    );
    assert.equal(res.status, 401);
  });

  it("ME-PROF-02 signed-in can update own name", async () => {
    setActor(actors.studentA);
    const res = await profilePATCH(
      jsonRequest("http://localhost/api/me/profile", { full_name: "Ada Lovelace" }, "PATCH"),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.id, actors.studentA.id);
    assert.equal(body.user.full_name, "Ada Lovelace");
  });

  it("ME-SUB-01 student → 403", async () => {
    setActor(actors.studentA);
    const res = await subscriptionGET();
    assert.equal(res.status, 403);
  });

  it("ME-SUB-02 teacher → 200", async () => {
    setActor(actors.teacherA);
    const res = await subscriptionGET();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.subscription);
  });

  it("ME-DEL-01 anon → 401", async () => {
    setActor(null);
    const res = await meDELETE();
    assert.equal(res.status, 401);
    assert.deepEqual(l2Stubs.deletedUserIds, []);
  });

  it("ME-DEL-02 signed-in only deletes self", async () => {
    setActor(actors.studentA);
    const res = await meDELETE();
    assert.equal(res.status, 200);
    assert.deepEqual(l2Stubs.deletedUserIds, [actors.studentA.id]);
  });
});
