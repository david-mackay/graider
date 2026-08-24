"use client";

import { SignOutButton } from "@clerk/nextjs";

export default function HeaderSignOutButton() {
  return (
    <SignOutButton redirectUrl="/">
      <button
        type="button"
        className="cursor-pointer rounded-full px-3 py-1.5 text-sm font-bold text-ink-soft transition-colors duration-150 hover:text-pen"
      >
        Sign out
      </button>
    </SignOutButton>
  );
}
