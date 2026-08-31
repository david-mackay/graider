import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canApplyOcrToAttempt } from "@/lib/attempt-ocr-policy";

describe("M6 attempt-ocr-policy (GR-04 GR-05 GR-06)", () => {
  it("GR-04 refuses in-progress digital student attempt", () => {
    const gate = canApplyOcrToAttempt({ source: "student", submittedAt: null });
    assert.equal(gate.ok, false);
    if (!gate.ok) {
      assert.equal(gate.status, 409);
      assert.match(gate.reason, /in-progress/i);
    }
  });

  it("GR-05 refuses submitted digital student attempt", () => {
    const gate = canApplyOcrToAttempt({
      source: "student",
      submittedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.match(gate.reason, /digitally/i);
  });

  it("GR-06 allows teacher_ocr / non-student sources", () => {
    assert.equal(canApplyOcrToAttempt({ source: "teacher_ocr", submittedAt: null }).ok, true);
    assert.equal(canApplyOcrToAttempt({ source: "teacher_ocr", submittedAt: new Date() }).ok, true);
  });

  it("does not block creating a separate paper attempt beside a digital one", () => {
    const digital = canApplyOcrToAttempt({
      source: "student",
      submittedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    assert.equal(digital.ok, false);
    const paper = canApplyOcrToAttempt({ source: "teacher_ocr", submittedAt: new Date() });
    assert.equal(paper.ok, true);
  });
});
