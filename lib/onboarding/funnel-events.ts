export const ONBOARDING_EVENTS = {
  EMOTIONAL_HOOK: "onboarding_emotional_hook",
  CAPABILITIES: "onboarding_capabilities",
  ANSWER_KEY: "onboarding_answer_key",
  PAPER_UPLOAD: "onboarding_paper_upload",
  FIRST_GRADE_RENDERED: "onboarding_first_grade_rendered",
  SAVE_PROGRESS: "onboarding_save_progress",
  AUTH_STARTED: "onboarding_auth_started",
  AUTH_COMPLETE: "onboarding_auth_complete",
  CLASS_SYNCED: "onboarding_class_synced",
} as const;

export type OnboardingEventName = (typeof ONBOARDING_EVENTS)[keyof typeof ONBOARDING_EVENTS];

const SESSION_KEY = "graider:onboarding:fired-events:v1";

function getFiredSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? new Set(arr.filter((v) => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function persistFiredSet(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // sessionStorage unavailable — fail silent.
  }
}

export function fireEvent(name: OnboardingEventName, payload?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const fired = getFiredSet();
  if (fired.has(name)) return;
  fired.add(name);
  persistFiredSet(fired);

  // Ship to stub endpoint so the events are observable in dev.
  // Use sendBeacon when available so the request survives navigation.
  const body = JSON.stringify({ name, payload, firedAt: new Date().toISOString() });
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/onboarding/analytics-stub", blob);
      return;
    }
  } catch {
    // Fall through to fetch.
  }
  void fetch("/api/onboarding/analytics-stub", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics is best-effort; never break the user flow.
  });
}
