import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { classes } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { invalidateClassMemberCaches } from "@/lib/classes/invalidate";

type Params = { classId: string };
type RouteContext = { params: Params | Promise<Params> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requireRole("teacher");
    const { classId } = await params;
    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    await requireClassAccess(classId, ["teacher"]);

    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required." }, { status: 400 });
    }

    const [updated] = await db
      .update(classes)
      .set({ name, updatedAt: new Date() })
      .where(eq(classes.id, classId))
      .returning({
        id: classes.id,
        name: classes.name,
        ownerUserId: classes.ownerUserId,
        inviteCode: classes.inviteCode,
        createdAt: classes.createdAt,
        updatedAt: classes.updatedAt,
      });

    if (!updated) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    await invalidateClassMemberCaches(classId);

    return NextResponse.json({
      class: {
        id: updated.id,
        name: updated.name,
        owner_user_id: updated.ownerUserId,
        invite_code: updated.inviteCode,
        created_at: updated.createdAt?.toISOString() ?? null,
        updated_at: updated.updatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireRole("teacher");
    const { classId } = await params;
    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    await requireClassAccess(classId, ["teacher"]);

    const [row] = await db
      .select({ ownerUserId: classes.ownerUserId, name: classes.name })
      .from(classes)
      .where(eq(classes.id, classId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    if (row.ownerUserId !== user.id) {
      return NextResponse.json(
        { error: "Only the class owner can delete this class." },
        { status: 403 },
      );
    }

    // Invalidate member class lists before cascade removes memberships.
    await invalidateClassMemberCaches(classId);
    await db.delete(classes).where(eq(classes.id, classId));

    return NextResponse.json({ deleted: true, name: row.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
