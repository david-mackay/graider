/**
 * Pure invite/join policy helpers — keep route handlers thin and testable.
 */

export function normalizeInviteCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

export function assertInviteEmailBinding(params: {
  invitedEmail: string | null | undefined;
  profileEmail: string | null | undefined;
}): { ok: true } | { ok: false; status: 403; reason: string } {
  const invitedEmail = params.invitedEmail?.trim().toLowerCase() || null;
  if (!invitedEmail) return { ok: true };

  const profileEmail = params.profileEmail?.trim().toLowerCase() || null;
  if (!profileEmail) {
    return {
      ok: false,
      status: 403,
      reason:
        "This invite is tied to an email address. Sign in with that email, then try again.",
    };
  }
  if (profileEmail !== invitedEmail) {
    return {
      ok: false,
      status: 403,
      reason: "Invite email does not match your signed-in account.",
    };
  }
  return { ok: true };
}

/** Already-active members must not accept unrelated pending invites. */
export function shouldAcceptInviteForActiveMember(): boolean {
  return false;
}

export function isInviteJoinable(params: {
  status: string | null | undefined;
  role: string | null | undefined;
  invitedName: string | null | undefined;
  expiresAt: Date | string | null | undefined;
  now?: Date;
}): { ok: true } | { ok: false; status: 410 | 404; reason: string } {
  if (params.status !== "pending") {
    return { ok: false, status: 410, reason: "This invite code has already been used." };
  }
  if (params.role === "student" && !params.invitedName?.trim()) {
    return {
      ok: false,
      status: 410,
      reason:
        "This invite code is outdated. Ask your teacher to delete it and create a new named invite.",
    };
  }
  if (params.expiresAt) {
    const expires = params.expiresAt instanceof Date ? params.expiresAt : new Date(params.expiresAt);
    if (!Number.isNaN(expires.getTime()) && expires < (params.now ?? new Date())) {
      return { ok: false, status: 410, reason: "This invite code has expired." };
    }
  }
  return { ok: true };
}
