"use client";

import { useState } from "react";
import { btnSecondary } from "@/components/shared/ui";
import { handleJson } from "@/lib/dashboard-client";
import { setSignupIntent } from "@/lib/signup-intent";

type BecomeTeacherCardProps = {
  onStatus?: (message: string, type?: "info" | "error") => void;
};

/**
 * Escape hatch: account that landed in the student workspace by mistake
 * (e.g. teacher Google sign-in before profile setup). Allowed only when the
 * account has no active student class memberships (enforced by /api/me/role).
 */
export default function BecomeTeacherCard({ onStatus }: BecomeTeacherCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function switchToTeacher() {
    setBusy(true);
    setError(null);
    try {
      setSignupIntent("teacher");
      await handleJson(
        await fetch("/api/me/role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "teacher" }),
        }),
      );
      onStatus?.("Switched to teacher — opening your workspace.");
      window.location.href = "/t";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not switch to teacher.";
      setError(message);
      onStatus?.(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-line bg-cream/50 p-3">
      <p className="text-[11px] leading-snug text-ink-soft">
        Signed up to grade papers? Switch this account to the teacher workspace.
      </p>
      {error ? <p className="text-[11px] font-bold text-pen-deep">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void switchToTeacher()}
        className={`${btnSecondary} w-full justify-center py-1.5 text-xs disabled:opacity-50`}
      >
        {busy ? "Switching…" : "I’m a teacher"}
      </button>
    </div>
  );
}
