import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole, requireClassAccess, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { classInvitations, appUsers } from "@/drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

function makeInviteCode() {
  return randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

type Params = { classId: string };
type RouteContext = { params: Params | Promise<Params> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { classId } = await params;
    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    await requireRole("teacher");
    await requireClassAccess(classId, ["teacher"]);

    const rows = await db
      .select({
        id: classInvitations.id,
        code: classInvitations.invitationCode,
        role: classInvitations.role,
        status: classInvitations.status,
        invitedEmail: classInvitations.invitedEmail,
        invitedName: classInvitations.invitedName,
        expiresAt: classInvitations.expiresAt,
        createdAt: classInvitations.createdAt,
        studentId: classInvitations.studentId,
        singleUse: classInvitations.singleUse,
        acceptedByName: appUsers.fullName,
      })
      .from(classInvitations)
      .leftJoin(appUsers, eq(classInvitations.studentId, appUsers.id))
      .where(eq(classInvitations.classId, classId))
      .orderBy(desc(classInvitations.createdAt));

    const invitations = rows.map((row) => ({
      id: row.id,
      code: row.code,
      role: row.role,
      status: row.status,
      invited_email: row.invitedEmail,
      invited_name: row.invitedName,
      expires_at: row.expiresAt?.toISOString() ?? null,
      created_at: row.createdAt?.toISOString() ?? null,
      accepted_by_name: row.acceptedByName ?? row.invitedName ?? null,
      single_use: row.singleUse,
    }));

    return NextResponse.json({ invitations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { classId } = await params;
    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    const teacher = await requireRole("teacher");
    await getCurrentUser();
    await requireClassAccess(classId, ["teacher"]);

    const payload = (await request.json()) as Partial<{
      invited_email: string;
      invited_name: string;
      role: string;
      expires_in_days: number;
      single_use: boolean;
    }>;
    const role = payload.role === "teacher" ? "teacher" : "student";
    const invitedEmail = payload.invited_email?.trim().toLowerCase() || null;
    const invitedName = payload.invited_name?.trim() || null;

    if (role === "student") {
      if (!invitedName) {
        return NextResponse.json(
          { error: "Student invites must include a name." },
          { status: 400 },
        );
      }
    }

    // Student invites are always single-use and name-bound.
    const singleUse = role === "student" ? true : payload.single_use !== false;

    let expiresAt: Date | null = null;
    if (typeof payload.expires_in_days === "number" && payload.expires_in_days > 0) {
      expiresAt = new Date(Date.now() + payload.expires_in_days * 24 * 60 * 60 * 1000);
    }

    const invitationCode = makeInviteCode();
    const [inserted] = await db
      .insert(classInvitations)
      .values({
        classId,
        invitedEmail,
        invitedName,
        invitationCode,
        invitedBy: teacher.id,
        role,
        expiresAt,
        singleUse,
      })
      .returning({
        invitationCode: classInvitations.invitationCode,
        role: classInvitations.role,
        expiresAt: classInvitations.expiresAt,
        singleUse: classInvitations.singleUse,
        invitedName: classInvitations.invitedName,
      });

    if (!inserted) {
      return NextResponse.json({ error: "Failed to create invitation." }, { status: 500 });
    }

    return NextResponse.json({
      invitation_code: inserted.invitationCode,
      invited_email: invitedEmail,
      invited_name: inserted.invitedName,
      role: inserted.role,
      expires_at: inserted.expiresAt?.toISOString() ?? null,
      single_use: inserted.singleUse,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { classId } = await params;
    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    await requireRole("teacher");
    await requireClassAccess(classId, ["teacher"]);

    const payload = (await request.json()) as { invitationId?: string };
    const invitationId = payload.invitationId?.trim();
    if (!invitationId) {
      return NextResponse.json({ error: "invitationId is required." }, { status: 400 });
    }

    const [invitation] = await db
      .select({ id: classInvitations.id })
      .from(classInvitations)
      .where(
        and(
          eq(classInvitations.id, invitationId),
          eq(classInvitations.classId, classId),
        ),
      )
      .limit(1);

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    await db.delete(classInvitations).where(eq(classInvitations.id, invitationId));

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
