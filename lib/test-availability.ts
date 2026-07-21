import type { TestStatus } from "@/lib/types";

export type TestScheduleFields = {
  status: string | null | undefined;
  opensAt: Date | string | null | undefined;
  closesAt: Date | string | null | undefined;
  durationMinutes: number | null | undefined;
  allowLateSubmit?: boolean | null;
};

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
  // Legacy rows without status: treat as open so existing classes keep working.
  return "open";
}

/** Whether a student may start (or continue a draft) right now. */
export function isTestAvailableNow(test: TestScheduleFields, now = new Date()): boolean {
  const status = normalizeTestStatus(test.status);
  if (status === "draft" || status === "closed") return false;
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
  let durationEnd: Date | null = null;
  if (started && typeof duration === "number" && duration > 0) {
    durationEnd = new Date(started.getTime() + duration * 60_000);
  }
  if (closesAt && durationEnd) {
    return closesAt.getTime() < durationEnd.getTime() ? closesAt : durationEnd;
  }
  return durationEnd ?? closesAt;
}

/** Whether submit is allowed for an in-progress (or just-started) attempt. */
export function canSubmitAttempt(
  test: TestScheduleFields,
  startedAt: Date | string | null | undefined,
  now = new Date(),
): { ok: true } | { ok: false; reason: string } {
  if (!isTestAvailableNow(test, now) && !test.allowLateSubmit) {
    // Still allow submit if within duration window from start even if window flipped,
    // unless allowLateSubmit is false and past deadline.
  }
  const deadline = getAttemptDeadline(test, startedAt);
  if (deadline && now > deadline && !test.allowLateSubmit) {
    return { ok: false, reason: "Time is up for this test." };
  }
  const status = normalizeTestStatus(test.status);
  if (status === "draft") {
    return { ok: false, reason: "This test is not available." };
  }
  if (status === "closed" && !test.allowLateSubmit) {
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
