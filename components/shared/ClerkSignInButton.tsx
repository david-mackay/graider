"use client";

import { SignInButton } from "@clerk/nextjs";
import type { ReactNode } from "react";

type ClerkSignInButtonProps = {
  children: ReactNode;
  mode?: "modal" | "redirect";
  fallbackRedirectUrl?: string;
  className?: string;
};

/**
 * Wraps Clerk SignInButton when configured; otherwise renders a plain link
 * so static builds succeed without NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.
 */
export default function ClerkSignInButton({
  children,
  mode = "modal",
  fallbackRedirectUrl,
  className,
}: ClerkSignInButtonProps) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

  if (!publishableKey) {
    const href = fallbackRedirectUrl
      ? `/sign-in?redirect_url=${encodeURIComponent(fallbackRedirectUrl)}`
      : "/sign-in";
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <SignInButton mode={mode} fallbackRedirectUrl={fallbackRedirectUrl}>
      {children}
    </SignInButton>
  );
}
