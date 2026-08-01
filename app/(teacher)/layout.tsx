import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { getCurrentUser } from "@/lib/auth";
import AppHeader from "@/components/shared/AppHeader";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.userId) {
    redirect("/");
  }

  const user = await getCurrentUser();
  if (user.role !== "teacher") {
    redirect("/s");
  }

  return (
    <>
      <AppHeader
        href="/t"
        rightSlot={
          <>
            <Link
              href="/t/billing"
              className="hidden sm:inline text-sm font-semibold text-pen hover:text-pen-deep"
            >
              Billing
            </Link>
            <span className="hidden sm:inline-flex items-center rounded-full bg-pen-wash px-2.5 py-0.5 text-xs font-bold text-pen-deep ring-1 ring-pen-soft/60">
              Teacher
            </span>
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          </>
        }
      />
      <div className="min-h-[calc(100vh-3.5rem)]">{children}</div>
    </>
  );
}
