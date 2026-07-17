import {
  ONBOARDING_VAULT_VERSION,
  hasAnswerKey,
  type OnboardingStep,
  type OnboardingVault,
} from "./types";

export const VAULT_KEY = "graider:onboarding:vault:v1";

let availabilityCache: boolean | null = null;

/**
 * Returns true iff `window.localStorage` is reachable and a write/remove
 * round-trip succeeds. Memoized for the lifetime of the page.
 *
 * Safari private mode, server-side rendering, and aggressive privacy
 * extensions all force this to `false`.
 */
export function isVaultAvailable(): boolean {
  if (availabilityCache !== null) return availabilityCache;
  if (typeof window === "undefined") {
    availabilityCache = false;
    return false;
  }
  try {
    const probeKey = "__graider_vault_probe__";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    availabilityCache = true;
    return true;
  } catch {
    availabilityCache = false;
    return false;
  }
}

/**
 * Reads the vault from localStorage. Returns `null` when:
 * - localStorage is unavailable (SSR / Safari private mode)
 * - the key is missing
 * - the JSON is malformed (logs a warning, does not throw)
 * - the persisted `schemaVersion` does not match the current version
 */
export function getVault(): OnboardingVault | null {
  if (!isVaultAvailable()) return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(VAULT_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn("[onboarding/vault] Discarding malformed vault JSON", error);
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { schemaVersion?: unknown }).schemaVersion !==
      ONBOARDING_VAULT_VERSION
  ) {
    return null;
  }
  return parsed as OnboardingVault;
}

/**
 * Read-modify-write merge into the vault. Initializes a fresh vault on the
 * first call (with `schemaVersion` and `startedAt`). Returns the new vault,
 * or `null` if localStorage is unavailable.
 */
export function setVault(
  update: Partial<OnboardingVault>,
): OnboardingVault | null {
  if (!isVaultAvailable()) return null;
  const existing = getVault();
  const base: OnboardingVault =
    existing ?? {
      schemaVersion: ONBOARDING_VAULT_VERSION,
      startedAt: new Date().toISOString(),
    };
  const next: OnboardingVault = {
    ...base,
    ...update,
    // schemaVersion is invariant — never let an update overwrite it.
    schemaVersion: ONBOARDING_VAULT_VERSION,
  };
  try {
    window.localStorage.setItem(VAULT_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("[onboarding/vault] Failed to persist vault", error);
    return null;
  }
  return next;
}

/**
 * Removes the vault key. No-ops if localStorage is unavailable or the
 * underlying remove call throws.
 */
export function clearVault(): void {
  if (!isVaultAvailable()) return;
  try {
    window.localStorage.removeItem(VAULT_KEY);
  } catch {
    // Swallow — clearing is best-effort.
  }
}

/**
 * Derives the next onboarding step from vault state. Used by the routing
 * intercept to drop a returning user back where they left off.
 */
export function getResumeStep(vault: OnboardingVault | null): OnboardingStep {
  if (!vault || !hasAnswerKey(vault)) return "hook";
  if (!vault.studentPaper) return "upload";
  if (!vault.sampleGrade) return "result";
  if (!vault.completedAt) return "save";
  if (vault.syncedAt) return "completed";
  return "save";
}
