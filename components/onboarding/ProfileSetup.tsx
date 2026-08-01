"use client";

import { FormEvent, useEffect, useState } from "react";
import { Card, FormField, btnPrimary, inputClass } from "@/components/shared/ui";
import { BrandMark, Wordmark } from "@/components/shared/Brand";
import { handleJson } from "@/lib/dashboard-client";
import {
  clearSignupIntent,
  getSignupIntent,
  getStoredInviteCode,
} from "@/lib/signup-intent";
import type { AppRole } from "@/lib/types";

type ProfileSetupProps = {
  initialName?: string;
  initialRole: AppRole;
  /** Prefill when arriving with a code (legacy deep links still supported). */
  initialInviteCode?: string;
  /** When set, role cannot be changed (enforces teacher vs student entry paths). */
  lockedRole?: AppRole;
  onComplete: (data: { full_name: string; role: AppRole }) => void | Promise<void>;
};

export default function ProfileSetup({
  initialName = "",
  initialRole,
  initialInviteCode = "",
  lockedRole,
  onComplete,
}: ProfileSetupProps) {
  const [name, setName] = useState(initialName);
  const [role, setRole] = useState<AppRole>(lockedRole ?? initialRole);
  const [inviteCode, setInviteCode] = useState(initialInviteCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Allows escaping a teacher-locked setup into the student join path. */
  const [escapedToStudent, setEscapedToStudent] = useState(false);

  const effectiveLock: AppRole | undefined = escapedToStudent ? "student" : lockedRole;
  const roleLocked = Boolean(effectiveLock);

  useEffect(() => {
    const intent = getSignupIntent();
    const storedInvite = getStoredInviteCode();
    if (escapedToStudent) {
      setRole("student");
    } else if (lockedRole) {
      setRole(lockedRole);
    } else if (intent) {
      setRole(intent);
    }
    if (!inviteCode.trim() && storedInvite) {
      setInviteCode(storedInvite);
    }
    if (!inviteCode.trim() && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const join = params.get("join")?.trim();
      if (join) setInviteCode(join.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once; escape handled separately
  }, [escapedToStudent, lockedRole]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    if (role === "student" && !inviteCode.trim()) {
      setError("Students need an invite code from their teacher to join.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await handleJson(
        await fetch("/api/me/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: name }),
        }),
      );
      if (role === "student") {
        await handleJson(
          await fetch("/api/classes/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
          }),
        );
      }
      await handleJson(
        await fetch("/api/me/role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        }),
      );
      clearSignupIntent();
      await onComplete({ full_name: name, role });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  const roleOption = (value: AppRole, label: string, sub: string) => (
    <button
      type="button"
      onClick={() => {
        if (roleLocked) return;
        setRole(value);
      }}
      disabled={roleLocked && effectiveLock !== value}
      className={`cursor-pointer rounded-2xl border-2 px-4 py-3 text-left transition-all duration-150 disabled:cursor-default ${
        role === value
          ? "border-pen bg-pen-wash"
          : "border-line bg-paper hover:border-ink-faint"
      } ${roleLocked && effectiveLock !== value ? "opacity-40" : ""}`}
    >
      <span className={`block text-sm font-bold ${role === value ? "text-pen-deep" : "text-ink"}`}>{label}</span>
      <span className="mt-0.5 block text-xs text-ink-faint">{sub}</span>
    </button>
  );

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
      <div className="w-full max-w-md animate-rise px-4">
        <Card>
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 inline-flex">
              <BrandMark className="h-14 w-14" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-ink">
              Welcome to <Wordmark className="text-[1em]" />
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {role === "student"
                ? "Confirm your name and join with your invite code."
                : "How should we write your name on the papers?"}
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <FormField label="Your name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Smith"
                required
                autoFocus
              />
            </FormField>
            {roleLocked && effectiveLock ? (
              <p className="rounded-xl border border-line bg-cream/60 px-3 py-2 text-xs text-ink-soft">
                Continuing as{" "}
                <span className="font-bold text-ink">
                  {effectiveLock === "student" ? "Student" : "Teacher"}
                </span>
                {effectiveLock === "student"
                  ? " — you’ll join a class with your invite code."
                  : " — you’ll get the grading workspace."}
              </p>
            ) : (
              <FormField label="I am a…">
                <div className="grid grid-cols-2 gap-3">
                  {roleOption("teacher", "Teacher", "I grade the stacks")}
                  {roleOption("student", "Student", "I take the tests")}
                </div>
              </FormField>
            )}
            {role === "student" ? (
              <FormField
                label="Invite code"
                hint="Ask your teacher for your personal invite code."
              >
                <input
                  className={`${inputClass} font-mono tracking-wider uppercase`}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AB12CD"
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
              </FormField>
            ) : null}
            {error ? <p className="text-xs font-bold text-pen-deep">{error}</p> : null}
            <button
              disabled={busy || !name.trim() || (role === "student" && !inviteCode.trim())}
              className={`${btnPrimary} w-full py-3`}
              type="submit"
            >
              {busy ? "Saving…" : role === "student" ? "Join class" : "Continue"}
            </button>
            {lockedRole === "teacher" && !escapedToStudent ? (
              <p className="text-center text-xs text-ink-faint">
                Meant to be a student?{" "}
                <button
                  type="button"
                  className="cursor-pointer font-bold text-pen underline decoration-line underline-offset-2"
                  onClick={() => setEscapedToStudent(true)}
                >
                  Join a class instead
                </button>
              </p>
            ) : null}
          </form>
        </Card>
      </div>
    </div>
  );
}
