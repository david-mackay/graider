export function validateInviteCreate(params: {
  role: "teacher" | "student";
  invitedName: string | null | undefined;
}): { ok: true; singleUse: true } | { ok: false; reason: string } {
  if (params.role === "student" && !params.invitedName?.trim()) {
    return { ok: false, reason: "Student invites must include a name." };
  }
  // All invites are single-use; no open reusable join codes.
  return { ok: true, singleUse: true };
}
