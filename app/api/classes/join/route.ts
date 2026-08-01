import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUsers, classInvitations, classMemberships } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invalidateClassMemberCaches, invalidateUserClasses } from "@/lib/classes/invalidate";
import {
  assertInviteEmailBinding,
  isInviteJoinable,
  normalizeInviteCode,
  shouldAcceptInviteForActiveMember,
} from "@/lib/join-policy";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const payload = (await request.json()) as { inviteCode?: string; email?: string };
    const inviteCode = normalizeInviteCode(payload.inviteCode);

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
        studentId: classInvitations.studentId,
      })
      .from(classInvitations)
      .where(eq(classInvitations.invitationCode, inviteCode))
      .limit(1);

    if (!invitation) {
      return NextResponse.json({ error: "Invalid or expired invite code." }, { status: 404 });
    }

    const joinable = isInviteJoinable({
      status: invitation.status,
      role: invitation.role,
      invitedName: invitation.invitedName,
      expiresAt: invitation.expiresAt,
    });
    if (!joinable.ok) {
      return NextResponse.json({ error: joinable.reason }, { status: joinable.status });
    }

    const emailGate = assertInviteEmailBinding({
      invitedEmail: invitation.invitedEmail,
      profileEmail: user.email,
    });
    if (!emailGate.ok) {
      return NextResponse.json({ error: emailGate.reason }, { status: emailGate.status });
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

    // Already an active member: do not burn unrelated pending invites.
    if (member?.status === "active") {
      if (shouldAcceptInviteForActiveMember()) {
        // Reserved for future invite-claiming flows; currently always false.
      }
      return NextResponse.json({ classId: invitation.classId, status: "already_member" });
    }

    const result = await db.transaction(async (tx) => {
      // Atomic single-use claim.
      const [claimed] = await tx
        .update(classInvitations)
        .set({
          status: "accepted",
          studentId: user.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(classInvitations.id, invitation.id),
            eq(classInvitations.status, "pending"),
          ),
        )
        .returning({ id: classInvitations.id });

      if (!claimed) {
        return { conflict: true as const };
      }

      // Apply the reserved name onto the joining student profile when missing.
      if (assignedRole === "student" && invitation.invitedName) {
        const [profile] = await tx
          .select({ fullName: appUsers.fullName })
          .from(appUsers)
          .where(eq(appUsers.id, user.id))
          .limit(1);
        if (!profile?.fullName?.trim()) {
          await tx
            .update(appUsers)
            .set({ fullName: invitation.invitedName })
            .where(eq(appUsers.id, user.id));
        }
      }

      if (member?.id) {
        // Reactivate without silently escalating role — keep existing class role.
        await tx
          .update(classMemberships)
          .set({ status: "active" })
          .where(eq(classMemberships.id, member.id));
      } else {
        await tx.insert(classMemberships).values({
          classId: invitation.classId,
          userId: user.id,
          role: assignedRole,
          status: "active",
        });
      }

      return { conflict: false as const, role: member?.role ?? assignedRole };
    });

    if (result.conflict) {
      return NextResponse.json(
        { error: "This invite code has already been used." },
        { status: 410 },
      );
    }

    await invalidateClassMemberCaches(invitation.classId);
    await invalidateUserClasses(user.id);

    return NextResponse.json({
      classId: invitation.classId,
      joined: true,
      role: result.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
