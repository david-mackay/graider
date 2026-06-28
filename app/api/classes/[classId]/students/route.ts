import { NextRequest, NextResponse } from "next/server";
import { requireClassAccess } from "@/lib/auth";
import { createClassStudent } from "@/lib/roster-students";

type Params = { classId: string };
type RouteContext = { params: Params | Promise<Params> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { classId } = await params;
    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    await requireClassAccess(classId, ["teacher"]);

    const body = (await request.json()) as Partial<{ full_name: string; email: string | null }>;
    const student = await createClassStudent({
      classId,
      fullName: body.full_name ?? "",
      email: body.email,
    });

    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : message.includes("required") || message.includes("valid")
            ? 400
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
