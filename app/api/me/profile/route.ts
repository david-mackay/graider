import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUsers } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = (await request.json()) as { full_name?: string };
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : null;

    if (!fullName) {
      return NextResponse.json({ error: "full_name is required." }, { status: 400 });
    }

    await db.update(appUsers).set({ fullName }).where(eq(appUsers.id, user.id));

    return NextResponse.json({ user: { ...user, full_name: fullName } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
