import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { assertCanCreateClass, SubscriptionLimitError } from "@/lib/subscriptions/limits";
import { db } from "@/lib/db";
import { classes, classMemberships } from "@/drizzle/schema";
import { randomUUID } from "crypto";
import { listClassesForUser, type ListedClass } from "@/lib/classes/list-for-user";
import { invalidateUserClasses } from "@/lib/classes/invalidate";

function generateInviteCode() {
  return randomUUID().split("-")[0].toUpperCase();
}

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    const result = await listClassesForUser(user.id);
    return NextResponse.json({ classes: result }, { headers: NO_STORE_HEADERS });
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
    await assertCanCreateClass(user.id);
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

    await invalidateUserClasses(user.id);

    const result: ListedClass = {
      id: classRow.id,
      name: classRow.name,
      owner_user_id: classRow.ownerUserId,
      invite_code: classRow.inviteCode,
      created_at: classRow.createdAt?.toISOString() ?? null,
      updated_at: classRow.updatedAt?.toISOString() ?? null,
      role_in_class: "teacher",
      student_count: 0,
    };

    return NextResponse.json({ class: result }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof SubscriptionLimitError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 402 },
      );
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
