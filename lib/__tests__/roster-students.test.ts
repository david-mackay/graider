import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isRosterManagedUserId,
  normalizeStudentEmail,
  normalizeStudentName,
} from "@/lib/roster-students";

describe("M0.3 roster-students validators", () => {
  it("RS-01 roster ids are prefix-gated", () => {
    assert.equal(isRosterManagedUserId("roster_abc"), true);
    assert.equal(isRosterManagedUserId("user_abc"), false);
    assert.equal(isRosterManagedUserId("roster"), false);
  });

  it("RS-02 normalizes and validates names", () => {
    assert.equal(normalizeStudentName("  Ada  "), "Ada");
    assert.throws(() => normalizeStudentName("   "), /required/i);
    assert.throws(() => normalizeStudentName("x".repeat(121)), /too long/i);
  });

  it("RS-03 normalizes and validates emails", () => {
    assert.equal(normalizeStudentEmail(null), null);
    assert.equal(normalizeStudentEmail(""), null);
    assert.equal(normalizeStudentEmail("  Ada@School.TEST "), "ada@school.test");
    assert.throws(() => normalizeStudentEmail("not-an-email"), /valid email/i);
    assert.throws(() => normalizeStudentEmail(123 as unknown as string), /string/i);
  });
});
