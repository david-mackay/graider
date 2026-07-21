"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import type { ReactNode } from "react";

type Mode = "sign-in" | "sign-up";

type ClerkAuthButtonProps = {
  children: ReactNode;
  mode?: "modal" | "redirect";
  authMode?: Mode;
  fallbackRedirectUrl?: string;
  className?: string;
};

/**
 * Clerk SignIn / SignUp when configured; plain links otherwise.
 */
export default function ClerkAuthButton({
  children,
  mode = "modal",
  authMode = "sign-in",
  fallbackRedirectUrl,
  className,
}: ClerkAuthButtonProps) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

  if (!publishableKey) {
    const path = authMode === "sign-up" ? "/sign-up" : "/sign-in";
    const href = fallbackRedirectUrl
      ? `${path}?redirect_url=${encodeURIComponent(fallbackRedirectUrl)}`
      : path;
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  if (authMode === "sign-up") {
    return (
      <SignUpButton mode={mode} fallbackRedirectUrl={fallbackRedirectUrl} forceRedirectUrl={fallbackRedirectUrl}>
        {children}
      </SignUpButton>
    );
  }

  return (
    <SignInButton mode={mode} fallbackRedirectUrl={fallbackRedirectUrl} forceRedirectUrl={fallbackRedirectUrl}>
      {children}
    </SignInButton>
  );
}
