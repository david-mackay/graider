import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";
import LandingPage from "@/components/marketing/LandingPage";

export default async function RootPage() {
  const session = await auth();

  if (!session?.userId) {
    return <LandingPage />;
  }

  const user = await getCurrentUser();
  redirect(user.role === "teacher" ? "/t" : "/s");
}
