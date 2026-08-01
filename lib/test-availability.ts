import type { TestStatus } from "@/lib/types";

export type TestScheduleFields = {
  status: string | null | undefined;
  opensAt: Date | string | null | undefined;
  closesAt: Date | string | null | undefined;
  durationMinutes: number | null | undefined;
  allowLateSubmit?: boolean | null;
};

/** Small skew allowance for client clocks / autosubmit latency (not a forged grace window). */
export const SUBMIT_CLOCK_SKEW_MS = 15_000;

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeTestStatus(raw: string | null | undefined): TestStatus {
  if (raw === "scheduled" || raw === "open" || raw === "closed" || raw === "draft") {
    return raw;
  }
  // Unknown / missing status: not administered until a teacher opens or schedules it.
  return "draft";
}

/** Whether a student may start a new attempt right now. */
export function isTestAvailableNow(test: TestScheduleFields, now = new Date()): boolean {
  const status = normalizeTestStatus(test.status);
  if (status === "draft") return false;

  if (status === "closed") {
    // Closed tests are only startable when late submissions are explicitly allowed.
    return Boolean(test.allowLateSubmit);
  }

  if (status === "open") {
    const closesAt = asDate(test.closesAt);
    if (closesAt && now > closesAt && !test.allowLateSubmit) return false;
    return true;
  }

  // scheduled: must be inside [opens_at, closes_at]
  const opensAt = asDate(test.opensAt);
  const closesAt = asDate(test.closesAt);
  if (opensAt && now < opensAt) return false;
  if (closesAt && now > closesAt && !test.allowLateSubmit) return false;
  if (!opensAt && !closesAt) return false;
  return true;
}

export function getAttemptDeadline(
  test: TestScheduleFields,
  startedAt: Date | string | null | undefined,
): Date | null {
  const closesAt = asDate(test.closesAt);
  const started = asDate(startedAt);
  const duration = test.durationMinutes;
  // Per-attempt duration is authoritative once started. The class window
  // (closesAt) gates *starting* via isTestAvailableNow, not finishing.
  if (started && typeof duration === "number" && duration > 0) {
    return new Date(started.getTime() + duration * 60_000);
  }
  return closesAt;
}

/**
 * Whether submit is allowed for an in-progress attempt.
 * Requires a prior start (startedAt). Does not authorize creating new attempts.
 */
export function canSubmitAttempt(
  test: TestScheduleFields,
  startedAt: Date | string | null | undefined,
  now = new Date(),
): { ok: true } | { ok: false; reason: string } {
  const status = normalizeTestStatus(test.status);
  if (status === "draft") {
    return { ok: false, reason: "This test is not available." };
  }

  const opensAt = asDate(test.opensAt);
  if (status === "scheduled" && opensAt && now < opensAt) {
    return { ok: false, reason: "This test is not open yet." };
  }

  const deadline = getAttemptDeadline(test, startedAt);
  if (deadline && now.getTime() > deadline.getTime() + SUBMIT_CLOCK_SKEW_MS && !test.allowLateSubmit) {
    return { ok: false, reason: "Time is up for this test." };
  }

  // Teacher closed the window: still allow finish if the student has remaining
  // duration (or late is on). Otherwise block.
  if (status === "closed" && !test.allowLateSubmit) {
    if (deadline && now.getTime() <= deadline.getTime() + SUBMIT_CLOCK_SKEW_MS) {
      return { ok: true };
    }
    return { ok: false, reason: "This test is closed." };
  }

  return { ok: true };
}

export function mapTestScheduleToApi(row: {
  status: string | null;
  opensAt: Date | null;
  closesAt: Date | null;
  durationMinutes: number | null;
  allowLateSubmit: boolean;
}) {
  const status = normalizeTestStatus(row.status);
  return {
    status,
    opens_at: row.opensAt?.toISOString() ?? null,
    closes_at: row.closesAt?.toISOString() ?? null,
    duration_minutes: row.durationMinutes,
    allow_late_submit: row.allowLateSubmit,
    available_now: isTestAvailableNow(row),
  };
}
