import { NextRequest, NextResponse } from "next/server";
import { AppRole } from "@/lib/types";
import { getCurrentUser, setUserRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { classMemberships } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { canSetAppRole } from "@/lib/role-policy";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

/**
 * Role changes are gated:
 * - student: always allowed (downgrade / BecomeStudent after invite join)
 * - teacher: only if already a teacher, or the account has no active student
 *   class memberships (first-time teacher path). Students who already joined
 *   a class cannot self-promote.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Partial<{ role: AppRole }>;
    const role = payload.role === "teacher" ? "teacher" : "student";
    const current = await getCurrentUser();

    let hasActiveStudentMembership = false;
    if (role === "teacher" && current.role !== "teacher") {
      const studentMemberships = await db
        .select({ id: classMemberships.id })
        .from(classMemberships)
        .where(
          and(
            eq(classMemberships.userId, current.id),
            eq(classMemberships.status, "active"),
            eq(classMemberships.role, "student"),
          ),
        )
        .limit(1);
      hasActiveStudentMembership = studentMemberships.length > 0;
    }

    const gate = canSetAppRole({
      currentRole: current.role,
      nextRole: role,
      hasActiveStudentMembership,
    });
    if (!gate.ok) {
      return NextResponse.json({ error: gate.reason }, { status: 403 });
    }

    const user = await setUserRole(role);
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
