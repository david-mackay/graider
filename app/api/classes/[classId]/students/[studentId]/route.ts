import { NextRequest, NextResponse } from "next/server";
import { requireClassAccess } from "@/lib/auth";
import { removeClassStudent, updateClassStudent } from "@/lib/roster-students";
import { invalidateClassMemberCaches, invalidateUserClasses } from "@/lib/classes/invalidate";

type Params = { classId: string; studentId: string };
type RouteContext = { params: Params | Promise<Params> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { classId, studentId } = await params;
    if (!classId || !studentId) {
      return NextResponse.json({ error: "classId and studentId are required." }, { status: 400 });
    }

    await requireClassAccess(classId, ["teacher"]);

    const body = (await request.json()) as Partial<{ full_name: string; email: string | null }>;
    const student = await updateClassStudent({
      classId,
      studentId,
      fullName: body.full_name,
      email: body.email,
    });

    await invalidateClassMemberCaches(classId);
    return NextResponse.json({ student });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : message === "Student not found in this class."
            ? 404
            : message.includes("required") ||
                message.includes("valid") ||
                message.includes("update") ||
                message.includes("Signed-in student profiles")
              ? 400
              : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { classId, studentId } = await params;
    if (!classId || !studentId) {
      return NextResponse.json({ error: "classId and studentId are required." }, { status: 400 });
    }

    await requireClassAccess(classId, ["teacher"]);
    await removeClassStudent(classId, studentId);
    await invalidateClassMemberCaches(classId);
    await invalidateUserClasses(studentId);

    return NextResponse.json({ removed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : message === "Student not found in this class."
            ? 404
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
