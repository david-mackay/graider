"use client";

import { FormEvent, useState } from "react";
import { Card, FormField, btnPrimary, inputClass } from "@/components/shared/ui";
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

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-gradient-to-b from-indigo-50/60 via-white to-violet-50/40">
      <div className="w-full max-w-md px-4">
        <Card className="border-indigo-200">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200/60">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-indigo-950">Welcome to gr<span className="text-indigo-600">AI</span>der</h2>
            <p className="mt-1 text-sm text-slate-500">Set up your profile to get started.</p>
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
                <button
                  type="button"
                  onClick={() => setRole("teacher")}
                  className={`cursor-pointer rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
                    role === "teacher"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-indigo-100 bg-white text-slate-600 hover:border-indigo-200"
                  }`}
                >
                  Teacher
                </button>
                <button
                  type="button"
                  onClick={() => setRole("student")}
                  className={`cursor-pointer rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
                    role === "student"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-indigo-100 bg-white text-slate-600 hover:border-indigo-200"
                  }`}
                >
                  Student
                </button>
              </div>
            </FormField>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <button disabled={busy || !name.trim()} className={`${btnPrimary} w-full justify-center py-3`} type="submit">
              {busy ? "Saving…" : "Continue"}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
