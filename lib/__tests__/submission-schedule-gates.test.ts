import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canSubmitAttempt,
  isTestAvailableNow,
} from "@/lib/test-availability";

/**
 * Submission gate cases that are pure schedule policy (no route/DB).
 * Catalog: SUB-04, SUB-06, SUB-07 — client timed_out is ignored by canSubmitAttempt.
 */
describe("M5 submission schedule gates (pure)", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");

  it("SUB-04 start blocked when not available", () => {
    assert.equal(
      isTestAvailableNow(
        {
          status: "scheduled",
          opensAt: new Date(now.getTime() + 3_600_000),
          closesAt: new Date(now.getTime() + 7_200_000),
          durationMinutes: 60,
        },
        now,
      ),
      false,
    );
  });

  it("SUB-06 after deadline is blocked even if client claims timed_out", () => {
    // timed_out is a client flag; authorization uses canSubmitAttempt only.
    const startedAt = new Date(now.getTime() - 2 * 3_600_000);
    const check = canSubmitAttempt(
      {
        status: "open",
        opensAt: startedAt,
        closesAt: null,
        durationMinutes: 30,
        allowLateSubmit: false,
      },
      startedAt,
      now,
    );
    assert.equal(check.ok, false);
  });

  it("SUB-07 submit before opensAt is blocked", () => {
    const check = canSubmitAttempt(
      {
        status: "scheduled",
        opensAt: new Date(now.getTime() + 3_600_000),
        closesAt: new Date(now.getTime() + 7_200_000),
        durationMinutes: 60,
      },
      now,
      now,
    );
    assert.equal(check.ok, false);
  });
});
