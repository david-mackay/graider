"use client";

import Link from "next/link";
import ClerkAuthButton from "@/components/shared/ClerkAuthButton";
import { setSignupIntent } from "@/lib/signup-intent";

export default function MarketingAuthLinks() {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        href="/#student"
        className="cursor-pointer rounded-full px-3 py-2 text-sm font-bold text-ink-soft transition-colors duration-150 hover:text-pen"
      >
        Student
      </Link>
      <ClerkAuthButton authMode="sign-in" mode="modal" fallbackRedirectUrl="/t">
        <button
          type="button"
          onClick={() => setSignupIntent("teacher")}
          className="cursor-pointer rounded-full bg-pen px-5 py-2 text-sm font-bold text-white shadow-paper transition-all duration-150 hover:bg-pen-deep active:scale-[0.97]"
        >
          Teacher sign in
        </button>
      </ClerkAuthButton>
    </div>
  );
}
