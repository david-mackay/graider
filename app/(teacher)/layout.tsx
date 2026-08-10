import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { getCurrentUser } from "@/lib/auth";
import { needsProfileSetup } from "@/lib/post-auth-routing";
import AppHeader from "@/components/shared/AppHeader";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.userId) {
    redirect("/");
  }

  const user = await getCurrentUser();
  // New Clerk users default to role=student in DB. Teacher OAuth lands on /t before
  // ProfileSetup can flip the role — allow incomplete profiles through so they aren't
  // bounced into the student join flow.
  if (user.role !== "teacher" && !needsProfileSetup(user.full_name)) {
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
