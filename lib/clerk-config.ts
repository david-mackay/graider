/** True when Clerk public key is present (required for ClerkProvider / client components). */
export function hasClerkPublishableKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
}
