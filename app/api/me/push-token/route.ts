import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deletePushTokenForUser, upsertPushToken } from "@/lib/push-tokens/repository";

export const runtime = "nodejs";

type RegisterBody = {
  expoPushToken?: string;
  platform?: "ios" | "android" | null;
};

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = (await request.json()) as RegisterBody;
    const expoPushToken = body.expoPushToken?.trim();

    if (!expoPushToken || !expoPushToken.startsWith("ExponentPushToken[")) {
      return NextResponse.json({ error: "Invalid Expo push token." }, { status: 400 });
    }

    await upsertPushToken(user.id, expoPushToken, body.platform ?? null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = (await request.json()) as RegisterBody;
    const expoPushToken = body.expoPushToken?.trim();

    if (!expoPushToken) {
      return NextResponse.json({ error: "expoPushToken is required." }, { status: 400 });
    }

    await deletePushTokenForUser(user.id, expoPushToken);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
