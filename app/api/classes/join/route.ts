import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUsers, classInvitations, classMemberships } from "@/drizzle/schema";
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
        invitedName: classInvitations.invitedName,
        role: classInvitations.role,
        expiresAt: classInvitations.expiresAt,
        status: classInvitations.status,
        singleUse: classInvitations.singleUse,
      })
      .from(classInvitations)
      .where(eq(classInvitations.invitationCode, inviteCode))
      .limit(1);

    if (!invitation) {
      return NextResponse.json({ error: "Invalid or expired invite code." }, { status: 404 });
    }

    // Students may only join via a pending invite code (no open class codes).
    if (invitation.role !== "teacher" && invitation.status !== "pending") {
      return NextResponse.json(
        { error: "This invite code has already been used." },
        { status: 410 },
      );
    }

    // Pre-named-invite codes: ask teacher to delete and create a named invite.
    if (invitation.role === "student" && !invitation.invitedName?.trim()) {
      return NextResponse.json(
        {
          error:
            "This invite code is outdated. Ask your teacher to delete it and create a new named invite.",
        },
        { status: 410 },
      );
    }

    if (invitation.status === "accepted" && invitation.singleUse) {
      return NextResponse.json({ error: "This invite code has already been used." }, { status: 410 });
    }

    if (invitation.singleUse && invitation.status !== "pending") {
      return NextResponse.json({ error: "This invite code has already been used." }, { status: 410 });
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

    // Apply the reserved name onto the joining student profile when missing.
    if (assignedRole === "student" && invitation.invitedName) {
      const [profile] = await db
        .select({ fullName: appUsers.fullName })
        .from(appUsers)
        .where(eq(appUsers.id, user.id))
        .limit(1);
      if (!profile?.fullName?.trim()) {
        await db
          .update(appUsers)
          .set({ fullName: invitation.invitedName })
          .where(eq(appUsers.id, user.id));
      }
    }

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
      if (invitation.status === "pending") {
        await db
          .update(classInvitations)
          .set({
            status: "accepted",
            studentId: user.id,
            updatedAt: new Date(),
          })
          .where(eq(classInvitations.id, invitation.id));
      }
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

    await db
      .update(classInvitations)
      .set({
        status: "accepted",
        studentId: user.id,
        updatedAt: new Date(),
      })
      .where(eq(classInvitations.id, invitation.id));

    return NextResponse.json({ classId: invitation.classId, joined: true, role: assignedRole });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
