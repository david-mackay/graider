"use client";

import { FormEvent, useState } from "react";
import { btnSecondary, inputClass } from "@/components/shared/ui";
import { handleJson } from "@/lib/dashboard-client";

type BecomeStudentCardProps = {
  onStatus?: (message: string, type?: "info" | "error") => void;
};

/**
 * Escape hatch: teacher account that should have been a student.
 * Joins via invite code, flips app role to student, then sends them to /s.
 */
export default function BecomeStudentCard({ onStatus }: BecomeStudentCardProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await handleJson(
        await fetch("/api/classes/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteCode: code.trim() }),
        }),
      );
      await handleJson(
        await fetch("/api/me/role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "student" }),
        }),
      );
      onStatus?.("Switched to student — opening your classes.");
      window.location.href = "/s";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not switch to student.";
      setError(message);
      onStatus?.(message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full cursor-pointer text-left text-[11px] font-medium text-ink-faint underline decoration-line underline-offset-2 hover:text-pen"
      >
        Meant to be a student?
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-line bg-cream/50 p-3">
      <p className="text-[11px] leading-snug text-ink-soft">
        Enter your teacher’s invite code to join their class and switch this account to student.
      </p>
      <input
        className={`${inputClass} py-2 font-mono text-xs tracking-wider uppercase`}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Invite code"
        autoComplete="off"
        spellCheck={false}
        required
      />
      {error ? <p className="text-[11px] font-bold text-pen-deep">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className={`${btnSecondary} flex-1 justify-center py-1.5 text-xs disabled:opacity-50`}
        >
          {busy ? "Switching…" : "Join as student"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="cursor-pointer px-2 text-xs text-ink-faint hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
