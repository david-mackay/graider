import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";
import LandingPage from "@/components/marketing/LandingPage";
import { hasClerkPublishableKey } from "@/lib/clerk-config";
import { postAuthHomePath } from "@/lib/post-auth-routing";
import { parseSignupIntentCookie } from "@/lib/signup-intent";

export const dynamic = "force-dynamic";

type RootPageProps = {
  searchParams?: Promise<{ join?: string }> | { join?: string };
};

export default async function RootPage({ searchParams }: RootPageProps) {
  const params = await Promise.resolve(searchParams ?? {});
  const join = typeof params.join === "string" ? params.join.trim() : "";

  // Student invites land on the dedicated student landing page.
  if (join) {
    redirect(`/student?join=${encodeURIComponent(join)}`);
  }

  if (!hasClerkPublishableKey()) {
    return <LandingPage />;
  }

  const session = await auth();

  if (!session?.userId) {
    return <LandingPage />;
  }

  const user = await getCurrentUser();
  const jar = await cookies();
  const intent = parseSignupIntentCookie(jar.get("graider_signup_intent")?.value);
  redirect(
    postAuthHomePath({
      role: user.role,
      fullName: user.full_name,
      signupIntent: intent,
    }),
  );
}
