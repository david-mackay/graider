"use client";

import Link from "next/link";
import { SignOutButton, useUser } from "@clerk/nextjs";
import ClerkAuthButton from "@/components/shared/ClerkAuthButton";
import { setSignupIntent } from "@/lib/signup-intent";

const primaryBtn =
  "cursor-pointer rounded-full bg-pen px-5 py-2 text-sm font-bold text-white shadow-paper transition-all duration-150 hover:bg-pen-deep active:scale-[0.97]";

function TeacherSignIn() {
  return (
    <ClerkAuthButton authMode="sign-in" mode="modal" fallbackRedirectUrl="/t">
      <button
        type="button"
        onClick={() => setSignupIntent("teacher")}
        className={primaryBtn}
      >
        Teacher sign in
      </button>
    </ClerkAuthButton>
  );
}

function SessionActions() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return <div className="h-9 w-28" aria-hidden="true" />;
  }

  if (isSignedIn) {
    return (
      <SignOutButton redirectUrl="/">
        <button type="button" className={primaryBtn}>
          Sign out
        </button>
      </SignOutButton>
    );
  }

  return <TeacherSignIn />;
}

export default function MarketingAuthLinks() {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        href="/student"
        className="cursor-pointer rounded-full px-3 py-2 text-sm font-bold text-ink-soft transition-colors duration-150 hover:text-pen"
      >
        Student
      </Link>
      {hasClerk ? <SessionActions /> : <TeacherSignIn />}
    </div>
  );
}
