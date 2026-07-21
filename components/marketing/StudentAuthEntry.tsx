"use client";

import { useState } from "react";
import ClerkAuthButton from "@/components/shared/ClerkAuthButton";
import { setSignupIntent } from "@/lib/signup-intent";

type StudentAuthEntryProps = {
  /** Prefill from URL / invite deep link. */
  initialCode?: string;
  /** Compact layout for header / sidebar. */
  compact?: boolean;
};

export default function StudentAuthEntry({ initialCode = "", compact = false }: StudentAuthEntryProps) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const trimmed = code.trim().toUpperCase();
  const ready = trimmed.length >= 4;
  const redirect = ready ? `/s?join=${encodeURIComponent(trimmed)}` : "/s";

  function rememberStudentIntent() {
    if (!ready) return;
    setSignupIntent("student", trimmed);
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {!compact ? (
        <p className="text-sm text-ink-soft">
          Enter the invite code from your teacher, then create an account or sign in to join your class.
        </p>
      ) : null}
      <label className="block">
        <span className="sr-only">Invite code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Invite code"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 font-mono text-sm font-semibold tracking-wider text-ink outline-none focus:border-pen/50 focus:ring-2 focus:ring-pen-wash"
        />
      </label>
      <div className={`flex flex-wrap gap-2 ${compact ? "" : "sm:flex-nowrap"}`}>
        <ClerkAuthButton authMode="sign-up" mode="modal" fallbackRedirectUrl={redirect}>
          <button
            type="button"
            disabled={!ready}
            onClick={rememberStudentIntent}
            className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-full bg-pen px-5 py-2.5 text-sm font-bold text-white shadow-paper transition-all duration-150 hover:bg-pen-deep disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
          >
            Sign up as student
          </button>
        </ClerkAuthButton>
        <ClerkAuthButton authMode="sign-in" mode="modal" fallbackRedirectUrl={redirect}>
          <button
            type="button"
            disabled={!ready}
            onClick={rememberStudentIntent}
            className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-bold text-ink-soft transition-colors duration-150 hover:border-ink-faint hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sign in
          </button>
        </ClerkAuthButton>
      </div>
      {!ready ? (
        <p className="text-xs text-ink-faint">Ask your teacher for your personal invite code first.</p>
      ) : null}
    </div>
  );
}
