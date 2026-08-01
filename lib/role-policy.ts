/**
 * App-level role change policy (used by POST /api/me/role).
 * Keep this pure so permission tests can cover it without Clerk/DB.
 */
export function canSetAppRole(params: {
  currentRole: "teacher" | "student";
  nextRole: "teacher" | "student";
  hasActiveStudentMembership: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (params.nextRole === "teacher" && params.currentRole !== "teacher") {
    if (params.hasActiveStudentMembership) {
      return {
        ok: false,
        reason:
          "This account is already a student in a class. Ask your teacher for help switching roles.",
      };
    }
  }
  return { ok: true };
}
