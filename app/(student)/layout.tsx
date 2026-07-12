import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { getCurrentUser } from "@/lib/auth";
import AppHeader from "@/components/shared/AppHeader";

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
        rightSlot={<UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />}
      />
      <div className="min-h-[calc(100vh-3.5rem)]">{children}</div>
    </>
  );
}
