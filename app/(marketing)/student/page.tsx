import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";
import StudentLandingPage from "@/components/marketing/StudentLandingPage";
import { hasClerkPublishableKey } from "@/lib/clerk-config";

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
      if (user.role === "teacher") {
        redirect("/t");
      }
      redirect(join ? `/s?join=${encodeURIComponent(join)}` : "/s");
    }
  }

  return <StudentLandingPage inviteCode={join || undefined} />;
}
