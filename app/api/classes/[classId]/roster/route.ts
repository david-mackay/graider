import { NextResponse } from "next/server";
import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { classMemberships, appUsers } from "@/drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";
import { RosterEntry } from "@/lib/types";

type Params = {
  classId: string;
};
type RouteContext = { params: Params | Promise<Params> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { classId } = await params;
    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    await requireClassAccess(classId, ["teacher"]);

    const memberships = await db
      .select({ userId: classMemberships.userId })
      .from(classMemberships)
      .where(
        and(
          eq(classMemberships.classId, classId),
          eq(classMemberships.role, "student"),
          eq(classMemberships.status, "active"),
        ),
      );

    if (memberships.length === 0) {
      return NextResponse.json({ roster: [] satisfies RosterEntry[] });
    }

    const userIds = memberships.map((row) => row.userId);
    const users = await db
      .select({ id: appUsers.id, email: appUsers.email, fullName: appUsers.fullName })
      .from(appUsers)
      .where(inArray(appUsers.id, userIds));

    const roster: RosterEntry[] = users.map((user) => ({
      user_id: user.id,
      full_name: user.fullName,
      email: user.email,
    }));

    roster.sort((first, second) => {
      if (first.full_name && second.full_name) {
        return first.full_name.localeCompare(second.full_name);
      }
      if (first.full_name && !second.full_name) {
        return -1;
      }
      if (!first.full_name && second.full_name) {
        return 1;
      }
      return 0;
    });

    return NextResponse.json({ roster });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
