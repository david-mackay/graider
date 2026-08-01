/**
 * Pure submission / attempt access gates — keep route handlers thin and testable.
 */

export type MembershipRole = "teacher" | "student";

export function assertStudentClassEnrollment(params: {
  membershipRole: MembershipRole | null | undefined;
}): { ok: true } | { ok: false; status: 403; reason: string } {
  if (params.membershipRole !== "student") {
    return { ok: false, status: 403, reason: "You are not enrolled in this class." };
  }
  return { ok: true };
}

export function assertAttemptOwnership(params: {
  actorId: string;
  attemptStudentId: string;
}): { ok: true } | { ok: false; status: 403; reason: string } {
  if (params.actorId !== params.attemptStudentId) {
    return { ok: false, status: 403, reason: "FORBIDDEN" };
  }
  return { ok: true };
}

/** Draft autosave / continue only while not submitted. */
export function assertDraftMutable(params: {
  submittedAt: Date | string | null | undefined;
}): { ok: true } | { ok: false; status: 409; reason: string } {
  if (params.submittedAt) {
    return {
      ok: false,
      status: 409,
      reason: "This test has already been submitted.",
    };
  }
  return { ok: true };
}

export function assertSubmitHasStarted(params: {
  attemptExists: boolean;
}): { ok: true } | { ok: false; status: 400; reason: string } {
  if (!params.attemptExists) {
    return {
      ok: false,
      status: 400,
      reason: "Start the test before submitting answers.",
    };
  }
  return { ok: true };
}

export function assertNotAlreadySubmitted(params: {
  submittedAt: Date | string | null | undefined;
  attemptId?: string;
}): { ok: true } | { ok: false; status: 409; reason: string; attempt_id?: string } {
  if (params.submittedAt) {
    return {
      ok: false,
      status: 409,
      reason: "You have already submitted this test.",
      attempt_id: params.attemptId,
    };
  }
  return { ok: true };
}

/**
 * Who may read attempt detail (including answers / marks).
 * Teachers with class membership may always read; students only their own
 * graded attempt after grades are released.
 */
export function assertCanViewAttemptDetail(params: {
  membershipRole: MembershipRole | null | undefined;
  actorId: string;
  attemptStudentId: string;
  attemptStatus: string;
  gradesReleased: boolean;
}): { ok: true; isTeacher: boolean } | { ok: false; status: 403; reason: string } {
  if (!params.membershipRole) {
    return { ok: false, status: 403, reason: "FORBIDDEN" };
  }

  const isTeacher = params.membershipRole === "teacher";
  if (!isTeacher && params.attemptStudentId !== params.actorId) {
    return { ok: false, status: 403, reason: "FORBIDDEN" };
  }
  if (!isTeacher && (params.attemptStatus !== "graded" || !params.gradesReleased)) {
    return { ok: false, status: 403, reason: "Grade not yet available." };
  }
  return { ok: true, isTeacher };
}

export function assertAttemptGradeable(params: {
  submittedAt: Date | string | null | undefined;
}): { ok: true } | { ok: false; status: 409; reason: string } {
  if (!params.submittedAt) {
    return {
      ok: false,
      status: 409,
      reason: "This attempt is still in progress and cannot be graded yet.",
    };
  }
  return { ok: true };
}
