import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";
import LandingPage from "@/components/marketing/LandingPage";
import { hasClerkPublishableKey } from "@/lib/clerk-config";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  if (!hasClerkPublishableKey()) {
    return <LandingPage />;
  }

  const session = await auth();

  if (!session?.userId) {
    return <LandingPage />;
  }

  const user = await getCurrentUser();
  redirect(user.role === "teacher" ? "/t" : "/s");
}
