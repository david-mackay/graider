import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteUserAccount } from "@/lib/account-deletion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Permanently delete the authenticated user's account and associated Graider data.
 * Required for App Store compliance when account creation is offered.
 */
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    await deleteUserAccount(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status =
      message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
