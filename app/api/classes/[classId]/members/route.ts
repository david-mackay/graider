import { NextResponse } from "next/server";
import { requireClassAccess } from "@/lib/auth";
import { listClassMembers } from "@/lib/classes/list-members";

type Params = {
  classId: string;
};
type RouteContext = { params: Params | Promise<Params> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { classId } = await params;
    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    await requireClassAccess(classId, ["teacher"]);
    const members = await listClassMembers(classId);
    return NextResponse.json({ members });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
