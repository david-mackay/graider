import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.userId) {
    redirect("/");
  }

  const user = await getCurrentUser();
  if (user.role === "teacher") {
    redirect("/t");
  }

  return <>{children}</>;
}
