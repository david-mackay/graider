import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";
import StudentLandingPage from "@/components/marketing/StudentLandingPage";
import { hasClerkPublishableKey } from "@/lib/clerk-config";
import { needsProfileSetup, postAuthHomePath } from "@/lib/post-auth-routing";
import { parseSignupIntentCookie } from "@/lib/signup-intent";

export const dynamic = "force-dynamic";

type StudentPageProps = {
  searchParams?: Promise<{ join?: string }> | { join?: string };
};

export default async function StudentMarketingPage({ searchParams }: StudentPageProps) {
  const params = await Promise.resolve(searchParams ?? {});
  const join = typeof params.join === "string" ? params.join.trim() : "";

  if (hasClerkPublishableKey()) {
    const session = await auth();
    if (session?.userId) {
      const user = await getCurrentUser();
      const jar = await cookies();
      const intent = parseSignupIntentCookie(jar.get("graider_signup_intent")?.value);

      // Teachers (or incomplete profiles with teacher intent) leave the student funnel.
      if (user.role === "teacher" || (needsProfileSetup(user.full_name) && intent !== "student")) {
        redirect(
          postAuthHomePath({
            role: user.role,
            fullName: user.full_name,
            signupIntent: intent ?? "teacher",
          }),
        );
      }

      redirect(join ? `/s?join=${encodeURIComponent(join)}` : "/s");
    }
  }

  return <StudentLandingPage inviteCode={join || undefined} />;
}
