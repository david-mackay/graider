import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SUBMIT_CLOCK_SKEW_MS,
  canSubmitAttempt,
  getAttemptDeadline,
  isTestAvailableNow,
  normalizeTestStatus,
} from "@/lib/test-availability";

function hoursFrom(base: Date, hours: number) {
  return new Date(base.getTime() + hours * 3_600_000);
}

describe("M0.1 test-availability", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");

  it("TA-01 draft is never available to start", () => {
    assert.equal(isTestAvailableNow({ status: "draft", opensAt: null, closesAt: null, durationMinutes: null }, now), false);
  });

  it("TA-02 open with no close is available", () => {
    assert.equal(
      isTestAvailableNow({ status: "open", opensAt: now, closesAt: null, durationMinutes: null }, now),
      true,
    );
  });

  it("TA-03 open past closesAt without late is unavailable", () => {
    assert.equal(
      isTestAvailableNow(
        {
          status: "open",
          opensAt: hoursFrom(now, -2),
          closesAt: hoursFrom(now, -1),
          durationMinutes: null,
          allowLateSubmit: false,
        },
        now,
      ),
      false,
    );
  });

  it("TA-04 open past closesAt with late is available", () => {
    assert.equal(
      isTestAvailableNow(
        {
          status: "open",
          opensAt: hoursFrom(now, -2),
          closesAt: hoursFrom(now, -1),
          durationMinutes: null,
          allowLateSubmit: true,
        },
        now,
      ),
      true,
    );
  });

  it("TA-05 scheduled before opensAt is unavailable", () => {
    assert.equal(
      isTestAvailableNow(
        {
          status: "scheduled",
          opensAt: hoursFrom(now, 1),
          closesAt: hoursFrom(now, 3),
          durationMinutes: null,
        },
        now,
      ),
      false,
    );
  });

  it("TA-06 scheduled inside window is available", () => {
    assert.equal(
      isTestAvailableNow(
        {
          status: "scheduled",
          opensAt: hoursFrom(now, -1),
          closesAt: hoursFrom(now, 1),
          durationMinutes: null,
        },
        now,
      ),
      true,
    );
  });

  it("TA-07 closed without late cannot start", () => {
    assert.equal(
      isTestAvailableNow(
        { status: "closed", opensAt: null, closesAt: hoursFrom(now, -1), durationMinutes: null, allowLateSubmit: false },
        now,
      ),
      false,
    );
  });

  it("TA-08 closed with late can start", () => {
    assert.equal(
      isTestAvailableNow(
        { status: "closed", opensAt: null, closesAt: hoursFrom(now, -1), durationMinutes: null, allowLateSubmit: true },
        now,
      ),
      true,
    );
  });

  it("TA-09 deadline prefers duration over closesAt once started", () => {
    const startedAt = hoursFrom(now, -0.5);
    const closesAt = hoursFrom(now, 0.1); // window ends soon
    const deadline = getAttemptDeadline(
      { status: "open", opensAt: startedAt, closesAt, durationMinutes: 60 },
      startedAt,
    );
    assert.ok(deadline);
    // 60 min from start, not the earlier closesAt
    assert.equal(deadline!.getTime(), hoursFrom(startedAt, 1).getTime());
  });

  it("TA-09b without duration, deadline is closesAt", () => {
    const startedAt = hoursFrom(now, -0.5);
    const closesAt = hoursFrom(now, 2);
    const deadline = getAttemptDeadline(
      { status: "open", opensAt: startedAt, closesAt, durationMinutes: null },
      startedAt,
    );
    assert.ok(deadline);
    assert.equal(deadline!.getTime(), closesAt.getTime());
  });
  it("TA-10 canSubmitAttempt blocks scheduled before opensAt", () => {
    const check = canSubmitAttempt(
      {
        status: "scheduled",
        opensAt: hoursFrom(now, 1),
        closesAt: hoursFrom(now, 3),
        durationMinutes: 60,
      },
      now,
      now,
    );
    assert.equal(check.ok, false);
    if (!check.ok) assert.match(check.reason, /not open/i);
  });

  it("TA-11 allows finish within remaining duration after close", () => {
    const startedAt = hoursFrom(now, -0.25); // 15 min ago
    const check = canSubmitAttempt(
      {
        status: "closed",
        opensAt: hoursFrom(now, -2),
        closesAt: hoursFrom(now, -0.1),
        durationMinutes: 60,
        allowLateSubmit: false,
      },
      startedAt,
      now,
    );
    assert.equal(check.ok, true);
  });

  it("TA-12 blocks past deadline + skew without late", () => {
    const startedAt = hoursFrom(now, -2);
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

  it("TA-13 allows past deadline when late is true", () => {
    const startedAt = hoursFrom(now, -2);
    const check = canSubmitAttempt(
      {
        status: "open",
        opensAt: startedAt,
        closesAt: null,
        durationMinutes: 30,
        allowLateSubmit: true,
      },
      startedAt,
      now,
    );
    assert.equal(check.ok, true);
  });

  it("TA-14 draft status always blocks submit", () => {
    const check = canSubmitAttempt(
      { status: "draft", opensAt: null, closesAt: null, durationMinutes: null },
      now,
      now,
    );
    assert.equal(check.ok, false);
  });

  it("normalizeTestStatus maps unknown to draft", () => {
    assert.equal(normalizeTestStatus(null), "draft");
    assert.equal(normalizeTestStatus("open"), "open");
  });

  it("SUBMIT_CLOCK_SKEW_MS is a small positive allowance", () => {
    assert.ok(SUBMIT_CLOCK_SKEW_MS > 0);
    assert.ok(SUBMIT_CLOCK_SKEW_MS <= 60_000);
  });
});
