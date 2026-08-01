import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateInviteCreate } from "@/lib/invite-create-policy";

describe("M2 invite-create-policy (INV-03)", () => {
  it("INV-03 student invites require a name and are always single-use", () => {
    const missing = validateInviteCreate({ role: "student", invitedName: "  " });
    assert.equal(missing.ok, false);

    const ok = validateInviteCreate({ role: "student", invitedName: "Ada" });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.singleUse, true);
  });

  it("teacher invites are also single-use", () => {
    const ok = validateInviteCreate({ role: "teacher", invitedName: null });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.singleUse, true);
  });
});
