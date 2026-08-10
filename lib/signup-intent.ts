/** Client-side signup intent so post-Clerk profile setup matches the entry path. */

const INTENT_KEY = "graider_signup_intent";
const INVITE_KEY = "graider_invite_code";
const INTENT_COOKIE = "graider_signup_intent";

export type SignupIntent = "teacher" | "student";

function writeIntentCookie(intent: SignupIntent | null) {
  if (typeof document === "undefined") return;
  try {
    if (!intent) {
      document.cookie = `${INTENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
      return;
    }
    // Survives Google OAuth round-trips better than sessionStorage alone;
    // readable on the server for layout / root redirects.
    document.cookie = `${INTENT_COOKIE}=${intent}; Path=/; Max-Age=86400; SameSite=Lax`;
  } catch {
    // ignore
  }
}

export function setSignupIntent(intent: SignupIntent, inviteCode?: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(INTENT_KEY, intent);
    writeIntentCookie(intent);
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
    writeIntentCookie(null);
  } catch {
    // ignore
  }
}

/** Server-side: read intent cookie set before OAuth. */
export function parseSignupIntentCookie(value: string | undefined | null): SignupIntent | null {
  return value === "teacher" || value === "student" ? value : null;
}
