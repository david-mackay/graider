import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";
import AppHeader from "@/components/shared/AppHeader";
import HeaderSignOutButton from "@/components/shared/HeaderSignOutButton";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.userId) {
    redirect("/");
  }

  const user = await getCurrentUser();
  if (user.role === "teacher") {
    redirect("/t");
  }

  return (
    <>
      <AppHeader
        href="/s"
        rightSlot={<HeaderSignOutButton />}
      />
      <div className="min-h-[calc(100vh-3.5rem)]">{children}</div>
    </>
  );
}
