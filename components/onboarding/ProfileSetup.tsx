"use client";

import { FormEvent, useState } from "react";
import { Card, FormField, btnPrimary, inputClass } from "@/components/shared/ui";
import { BrandMark, Wordmark } from "@/components/shared/Brand";
import { handleJson } from "@/lib/dashboard-client";
import type { AppRole } from "@/lib/types";

type ProfileSetupProps = {
  initialName?: string;
  initialRole: AppRole;
  onComplete: (data: { full_name: string; role: AppRole }) => void | Promise<void>;
};

export default function ProfileSetup({ initialName = "", initialRole, onComplete }: ProfileSetupProps) {
  const [name, setName] = useState(initialName);
  const [role, setRole] = useState<AppRole>(initialRole);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
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
      await handleJson(
        await fetch("/api/me/role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        }),
      );
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
      onClick={() => setRole(value)}
      className={`cursor-pointer rounded-2xl border-2 px-4 py-3 text-left transition-all duration-150 ${
        role === value
          ? "border-pen bg-pen-wash"
          : "border-line bg-paper hover:border-ink-faint"
      }`}
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
            <p className="mt-1 text-sm text-ink-soft">How should we write your name on the papers?</p>
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
            <FormField label="I am a…">
              <div className="grid grid-cols-2 gap-3">
                {roleOption("teacher", "Teacher", "I grade the stacks")}
                {roleOption("student", "Student", "I take the tests")}
              </div>
            </FormField>
            {error ? <p className="text-xs font-bold text-pen-deep">{error}</p> : null}
            <button disabled={busy || !name.trim()} className={`${btnPrimary} w-full py-3`} type="submit">
              {busy ? "Saving…" : "Continue"}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
