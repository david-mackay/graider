import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole, requireClassAccess, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { classInvitations } from "@/drizzle/schema";

function makeInviteCode() {
  return randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

type Params = { classId: string };
type RouteContext = { params: Params | Promise<Params> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { classId } = await params;
    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    const teacher = await requireRole("teacher");
    await getCurrentUser();
    await requireClassAccess(classId, ["teacher"]);

    const payload = (await request.json()) as Partial<{ invited_email: string; role: string }>;
    const invitedEmail = payload.invited_email?.trim().toLowerCase() || null;
    const role = payload.role === "teacher" ? "teacher" : "student";

    const invitationCode = makeInviteCode();
    const [inserted] = await db
      .insert(classInvitations)
      .values({
        classId,
        invitedEmail,
        invitationCode,
        invitedBy: teacher.id,
        role,
      })
      .returning({ invitationCode: classInvitations.invitationCode, role: classInvitations.role });

    if (!inserted) {
      return NextResponse.json({ error: "Failed to create invitation." }, { status: 500 });
    }

    return NextResponse.json({ invitation_code: inserted.invitationCode, invited_email: invitedEmail, role: inserted.role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
