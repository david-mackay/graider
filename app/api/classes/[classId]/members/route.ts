import { NextResponse } from "next/server";
import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { classMemberships, appUsers } from "@/drizzle/schema";
import { eq, inArray } from "drizzle-orm";

type Params = {
  classId: string;
};
type RouteContext = { params: Params | Promise<Params> };

type ClassMember = {
  user_id: string;
  role: "teacher" | "student";
  status: "active" | "pending";
  full_name: string | null;
  email: string | null;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { classId } = await params;
    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    await requireClassAccess(classId, ["teacher"]);

    const memberships = await db
      .select({
        userId: classMemberships.userId,
        role: classMemberships.role,
        status: classMemberships.status,
      })
      .from(classMemberships)
      .where(eq(classMemberships.classId, classId));

    if (memberships.length === 0) {
      return NextResponse.json({ members: [] });
    }

    const userIds = memberships.map((row) => row.userId);
    const users = await db
      .select({ id: appUsers.id, email: appUsers.email, fullName: appUsers.fullName })
      .from(appUsers)
      .where(inArray(appUsers.id, userIds));

    const userById = new Map(users.map((u) => [u.id, u]));

    const members: ClassMember[] = memberships.map((row) => {
      const user = userById.get(row.userId);
      return {
        user_id: row.userId,
        role: row.role === "teacher" ? "teacher" : "student",
        status: row.status === "pending" ? "pending" : "active",
        full_name: user?.fullName ?? null,
        email: user?.email ?? null,
      };
    });

    members.sort((first, second) => {
      if (first.role === "teacher" && second.role === "student") {
        return -1;
      }
      if (first.role === "student" && second.role === "teacher") {
        return 1;
      }
      return first.full_name && second.full_name ? first.full_name.localeCompare(second.full_name) : 0;
    });

    return NextResponse.json({ members });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
