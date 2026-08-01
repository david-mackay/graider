import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canSetAppRole } from "@/lib/role-policy";

describe("M1 role-policy (ME-ROLE)", () => {
  it("ME-ROLE-02 student with no memberships may become teacher", () => {
    const gate = canSetAppRole({
      currentRole: "student",
      nextRole: "teacher",
      hasActiveStudentMembership: false,
    });
    assert.equal(gate.ok, true);
  });

  it("ME-ROLE-03 student with membership cannot become teacher", () => {
    const gate = canSetAppRole({
      currentRole: "student",
      nextRole: "teacher",
      hasActiveStudentMembership: true,
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.match(gate.reason, /already a student/i);
  });

  it("ME-ROLE-04 teacher may become student", () => {
    const gate = canSetAppRole({
      currentRole: "teacher",
      nextRole: "student",
      hasActiveStudentMembership: false,
    });
    assert.equal(gate.ok, true);
  });

  it("already-teacher can reaffirm teacher even with student memberships elsewhere", () => {
    const gate = canSetAppRole({
      currentRole: "teacher",
      nextRole: "teacher",
      hasActiveStudentMembership: true,
    });
    assert.equal(gate.ok, true);
  });
});
