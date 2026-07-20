import { hasClerkPublishableKey } from "@/lib/clerk-config";
import SsoCallbackClient from "./sso-callback-client";

// OAuth redirect completion must run at request time inside ClerkProvider.
// Without this, `next build` prerenders the page and crashes when Clerk keys
// are missing (common on Render worker/CI builds).
export const dynamic = "force-dynamic";

export default function SsoCallbackPage() {
  if (!hasClerkPublishableKey()) {
    return (
      <div className="flex min-h-full items-center justify-center bg-cream px-6">
        <p className="text-center text-sm text-ink-soft">
          Sign-in is not configured for this environment.
        </p>
      </div>
    );
  }

  return <SsoCallbackClient />;
}
