import type { AppRole } from "@/lib/types";

/** True when the user still needs ProfileSetup (missing or Clerk placeholder name). */
export function needsProfileSetup(fullName: string | null | undefined): boolean {
  if (!fullName?.trim()) return true;
  return /^user_[a-zA-Z0-9]{20,}$/.test(fullName.trim());
}

/**
 * Where a signed-in user should land after auth.
 * Incomplete profiles follow signup intent (cookie), defaulting teacher-first.
 */
export function postAuthHomePath(params: {
  role: AppRole;
  fullName: string | null | undefined;
  signupIntent?: "teacher" | "student" | null;
}): "/t" | "/s" {
  if (needsProfileSetup(params.fullName)) {
    return params.signupIntent === "student" ? "/s" : "/t";
  }
  return params.role === "teacher" ? "/t" : "/s";
}
