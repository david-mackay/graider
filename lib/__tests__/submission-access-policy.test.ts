import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertAttemptGradeable,
  assertAttemptOwnership,
  assertCanViewAttemptDetail,
  assertDraftMutable,
  assertNotAlreadySubmitted,
  assertStudentClassEnrollment,
  assertSubmitHasStarted,
} from "@/lib/submission-access-policy";

describe("M5 submission-access-policy", () => {
  it("SUB-03 enrollment requires student membership", () => {
    assert.equal(assertStudentClassEnrollment({ membershipRole: "student" }).ok, true);
    assert.equal(assertStudentClassEnrollment({ membershipRole: null }).ok, false);
    assert.equal(assertStudentClassEnrollment({ membershipRole: "teacher" }).ok, false);
  });

  it("SUB-05 submit requires a prior start", () => {
    assert.equal(assertSubmitHasStarted({ attemptExists: true }).ok, true);
    const missing = assertSubmitHasStarted({ attemptExists: false });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.status, 400);
  });

  it("SUB-08 double submit is blocked", () => {
    const blocked = assertNotAlreadySubmitted({
      submittedAt: new Date(),
      attemptId: "a1",
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.status, 409);
      assert.equal(blocked.attempt_id, "a1");
    }
  });

  it("SUB-10 draft ownership", () => {
    assert.equal(
      assertAttemptOwnership({ actorId: "s1", attemptStudentId: "s1" }).ok,
      true,
    );
    const denied = assertAttemptOwnership({ actorId: "s2", attemptStudentId: "s1" });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.status, 403);
  });

  it("SUB-11 draft after submit", () => {
    const blocked = assertDraftMutable({ submittedAt: new Date() });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.status, 409);
  });

  it("SUB-13 student cannot view other attempt", () => {
    const denied = assertCanViewAttemptDetail({
      membershipRole: "student",
      actorId: "s2",
      attemptStudentId: "s1",
      attemptStatus: "graded",
      gradesReleased: true,
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.status, 403);
  });

  it("SUB-14 student cannot view own graded attempt before release", () => {
    const denied = assertCanViewAttemptDetail({
      membershipRole: "student",
      actorId: "s1",
      attemptStudentId: "s1",
      attemptStatus: "graded",
      gradesReleased: false,
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.reason, "Grade not yet available.");
  });

  it("teacher can view attempt regardless of release", () => {
    const ok = assertCanViewAttemptDetail({
      membershipRole: "teacher",
      actorId: "t1",
      attemptStudentId: "s1",
      attemptStatus: "submitted",
      gradesReleased: false,
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.isTeacher, true);
  });

  it("SUB-15 unsubmitted attempt is not gradeable", () => {
    const blocked = assertAttemptGradeable({ submittedAt: null });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.status, 409);
  });
});
