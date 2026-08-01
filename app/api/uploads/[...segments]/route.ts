import { NextResponse } from "next/server";
import path from "path";
import { getCurrentUser, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { gradeStackJobs, tests } from "@/drizzle/schema";
import { readFile } from "@/lib/storage";
import { and, eq, sql } from "drizzle-orm";
import { assertSafeStoragePath } from "@/lib/upload-policy";

export const runtime = "nodejs";

function resolveContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".heic" || ext === ".heif") return "image/heif";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

async function authorizeStackPreviewUpload(storagePath: string, uploadKey: string) {
  const [test] = await db
    .select({ classId: tests.classId })
    .from(tests)
    .where(eq(tests.id, uploadKey))
    .limit(1);

  if (test) {
    await requireClassAccess(test.classId, ["teacher"]);
    return;
  }

  const user = await getCurrentUser();
  const [jobByTest] = await db
    .select({ classId: gradeStackJobs.classId })
    .from(gradeStackJobs)
    .where(and(eq(gradeStackJobs.testId, uploadKey), eq(gradeStackJobs.teacherId, user.id)))
    .limit(1);

  if (jobByTest?.classId) {
    await requireClassAccess(jobByTest.classId, ["teacher"]);
    return;
  }

  const [jobByPath] = await db
    .select({ classId: gradeStackJobs.classId })
    .from(gradeStackJobs)
    .where(
      and(
        eq(gradeStackJobs.teacherId, user.id),
        sql`${gradeStackJobs.inputPayload}->'storagePaths' @> ${JSON.stringify([storagePath])}::jsonb`,
      ),
    )
    .limit(1);

  if (jobByPath?.classId) {
    await requireClassAccess(jobByPath.classId, ["teacher"]);
    return;
  }

  throw new Error("FORBIDDEN");
}

async function assertTeacherCanReadUpload(storagePath: string) {
  const safe = assertSafeStoragePath(storagePath);
  if (!safe.ok) {
    throw new Error("FORBIDDEN");
  }
  const normalized = storagePath.replace(/^\/+/, "");

  const stackMatch = normalized.match(/^stack-preview\/([^/]+)\//);
  if (stackMatch) {
    await authorizeStackPreviewUpload(normalized, stackMatch[1]);
    return;
  }

  const importMatch = normalized.match(/^imports\/([^/]+)\//);
  if (importMatch) {
    await requireClassAccess(importMatch[1], ["teacher"]);
    return;
  }

  throw new Error("FORBIDDEN");
}

type Params = { segments: string[] };
type RouteContext = { params: Params | Promise<Params> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await getCurrentUser();
    const { segments } = await params;
    if (!segments?.length) {
      return NextResponse.json({ error: "File path is required." }, { status: 400 });
    }

    const storagePath = segments.join("/");
    const safe = assertSafeStoragePath(storagePath);
    if (!safe.ok) {
      return NextResponse.json(
        { error: safe.reason },
        { status: safe.reason === "File path is required." ? 400 : 403 },
      );
    }
    await assertTeacherCanReadUpload(storagePath);

    const buffer = await readFile(storagePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": resolveContentType(storagePath),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
