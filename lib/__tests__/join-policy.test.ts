import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertInviteEmailBinding,
  isInviteJoinable,
  normalizeInviteCode,
  shouldAcceptInviteForActiveMember,
} from "@/lib/join-policy";

describe("M2 join-policy", () => {
  it("JOIN-06 normalizes invite codes to uppercase", () => {
    assert.equal(normalizeInviteCode("  ab12cd  "), "AB12CD");
  });

  it("JOIN-05 email binding requires Clerk profile email", () => {
    const missing = assertInviteEmailBinding({
      invitedEmail: "a@school.test",
      profileEmail: null,
    });
    assert.equal(missing.ok, false);

    const mismatch = assertInviteEmailBinding({
      invitedEmail: "a@school.test",
      profileEmail: "other@school.test",
    });
    assert.equal(mismatch.ok, false);

    const ok = assertInviteEmailBinding({
      invitedEmail: "A@School.TEST",
      profileEmail: "a@school.test",
    });
    assert.equal(ok.ok, true);
  });

  it("JOIN-04 active members must not burn pending invites", () => {
    assert.equal(shouldAcceptInviteForActiveMember(), false);
  });

  it("JOIN-03 used invites are not joinable", () => {
    const used = isInviteJoinable({
      status: "accepted",
      role: "student",
      invitedName: "Ada",
      expiresAt: null,
    });
    assert.equal(used.ok, false);
    if (!used.ok) assert.equal(used.status, 410);
  });

  it("JOIN-02 pending named student invite is joinable", () => {
    const ok = isInviteJoinable({
      status: "pending",
      role: "student",
      invitedName: "Ada",
      expiresAt: null,
    });
    assert.equal(ok.ok, true);
  });

  it("unnamed student invite is rejected", () => {
    const bad = isInviteJoinable({
      status: "pending",
      role: "student",
      invitedName: "  ",
      expiresAt: null,
    });
    assert.equal(bad.ok, false);
  });
});
