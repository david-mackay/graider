import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { classes } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

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
