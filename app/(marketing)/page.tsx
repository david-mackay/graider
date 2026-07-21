import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";
import LandingPage from "@/components/marketing/LandingPage";
import { hasClerkPublishableKey } from "@/lib/clerk-config";

export const dynamic = "force-dynamic";

type RootPageProps = {
  searchParams?: Promise<{ join?: string }> | { join?: string };
};

export default async function RootPage({ searchParams }: RootPageProps) {
  const params = await Promise.resolve(searchParams ?? {});
  const join = typeof params.join === "string" ? params.join.trim() : "";

  if (!hasClerkPublishableKey()) {
    return <LandingPage inviteCode={join || undefined} />;
  }

  const session = await auth();

  if (!session?.userId) {
    return <LandingPage inviteCode={join || undefined} />;
  }

  const user = await getCurrentUser();
  if (user.role === "teacher") {
    redirect("/t");
  }
  redirect(join ? `/s?join=${encodeURIComponent(join)}` : "/s");
}
