/** Client-side signup intent so post-Clerk profile setup matches the entry path. */

const INTENT_KEY = "graider_signup_intent";
const INVITE_KEY = "graider_invite_code";

export type SignupIntent = "teacher" | "student";

export function setSignupIntent(intent: SignupIntent, inviteCode?: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(INTENT_KEY, intent);
    if (inviteCode?.trim()) {
      sessionStorage.setItem(INVITE_KEY, inviteCode.trim().toUpperCase());
    } else if (intent === "teacher") {
      sessionStorage.removeItem(INVITE_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}

export function getSignupIntent(): SignupIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    return raw === "teacher" || raw === "student" ? raw : null;
  } catch {
    return null;
  }
}

export function getStoredInviteCode(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(INVITE_KEY)?.trim().toUpperCase() ?? "";
  } catch {
    return "";
  }
}

export function clearSignupIntent() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(INTENT_KEY);
    sessionStorage.removeItem(INVITE_KEY);
  } catch {
    // ignore
  }
}
