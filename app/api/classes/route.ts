import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { classes, classMemberships } from "@/drizzle/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { type SchoolClass } from "@/lib/types";

function generateInviteCode() {
  return randomUUID().split("-")[0].toUpperCase();
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    const memberships = await db
      .select({ classId: classMemberships.classId, role: classMemberships.role })
      .from(classMemberships)
      .where(
        and(
          eq(classMemberships.userId, user.id),
          eq(classMemberships.status, "active"),
        ),
      );

    const classIds = memberships.map((row) => row.classId);
    if (classIds.length === 0) {
      return NextResponse.json({ classes: [] });
    }

    const classRows = await db
      .select({
        id: classes.id,
        name: classes.name,
        owner_user_id: classes.ownerUserId,
        invite_code: classes.inviteCode,
        created_at: classes.createdAt,
      })
      .from(classes)
      .where(inArray(classes.id, classIds))
      .orderBy(desc(classes.createdAt));

    const membershipByClass = new Map<string, "teacher" | "student">();
    for (const row of memberships) {
      membershipByClass.set(row.classId, row.role as "teacher" | "student");
    }

    const result = classRows.map((row) => ({
      ...row,
      created_at: row.created_at?.toISOString() ?? null,
      role_in_class: membershipByClass.get(row.id),
    }));

    return NextResponse.json({ classes: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("teacher");
    const user = await getCurrentUser();
    const payload = (await request.json()) as Partial<{ name: string; inviteCode: string }>;
    const name = payload.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Class name is required." }, { status: 400 });
    }

    const inviteCode = payload.inviteCode?.trim() || generateInviteCode();

    const [classRow] = await db
      .insert(classes)
      .values({ ownerUserId: user.id, name, inviteCode })
      .returning();

    if (!classRow) {
      return NextResponse.json({ error: "Failed to create class." }, { status: 500 });
    }

    await db.insert(classMemberships).values({
      classId: classRow.id,
      userId: user.id,
      role: "teacher",
      status: "active",
    });

    const result: SchoolClass & { role_in_class: string } = {
      id: classRow.id,
      name: classRow.name,
      owner_user_id: classRow.ownerUserId,
      invite_code: classRow.inviteCode,
      created_at: classRow.createdAt?.toISOString() ?? null,
      updated_at: classRow.updatedAt?.toISOString() ?? null,
      role_in_class: "teacher",
    };

    return NextResponse.json({ class: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
