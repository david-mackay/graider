import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { classInvitations, classMemberships } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const payload = (await request.json()) as { inviteCode?: string; email?: string };
    const inviteCode = payload.inviteCode?.trim();
    const userEmail = payload.email?.trim().toLowerCase() || null;

    if (!inviteCode) {
      return NextResponse.json({ error: "inviteCode is required." }, { status: 400 });
    }

    const [invitation] = await db
      .select({
        id: classInvitations.id,
        classId: classInvitations.classId,
        invitedEmail: classInvitations.invitedEmail,
        role: classInvitations.role,
        expiresAt: classInvitations.expiresAt,
      })
      .from(classInvitations)
      .where(
        and(
          eq(classInvitations.invitationCode, inviteCode),
          eq(classInvitations.status, "pending"),
        ),
      )
      .limit(1);

    if (!invitation) {
      return NextResponse.json({ error: "Invalid or expired invite code." }, { status: 404 });
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invite code has expired." }, { status: 410 });
    }

    const invitedEmail = invitation.invitedEmail;
    if (invitedEmail && userEmail && userEmail !== invitedEmail) {
      return NextResponse.json({ error: "Invite email does not match current user." }, { status: 403 });
    }

    if (invitedEmail && user.email && user.email.toLowerCase() !== invitedEmail) {
      return NextResponse.json({ error: "Invite email does not match current user profile." }, { status: 403 });
    }

    const assignedRole = invitation.role === "teacher" ? "teacher" : "student";

    const [member] = await db
      .select({
        id: classMemberships.id,
        status: classMemberships.status,
        role: classMemberships.role,
      })
      .from(classMemberships)
      .where(
        and(
          eq(classMemberships.classId, invitation.classId),
          eq(classMemberships.userId, user.id),
        ),
      )
      .limit(1);

    if (member?.status === "active") {
      return NextResponse.json({ classId: invitation.classId, status: "already_member" });
    }

    if (member?.id) {
      await db
        .update(classMemberships)
        .set({ status: "active", role: assignedRole })
        .where(eq(classMemberships.id, member.id));
    } else {
      await db.insert(classMemberships).values({
        classId: invitation.classId,
        userId: user.id,
        role: assignedRole,
        status: "active",
      });
    }

    return NextResponse.json({ classId: invitation.classId, joined: true, role: assignedRole });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
