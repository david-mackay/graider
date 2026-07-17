"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * Completes OAuth redirect flows started via authenticateWithRedirect
 * (Google / Apple) and then Clerk sends the user to redirectUrlComplete.
 */
export default function SsoCallbackPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-cream">
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
