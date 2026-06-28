import { NextResponse } from "next/server";
import path from "path";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { tests } from "@/drizzle/schema";
import { readFile } from "@/lib/storage";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

function resolveContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

async function assertTeacherCanReadUpload(storagePath: string) {
  const normalized = storagePath.replace(/^\/+/, "");
  if (normalized.includes("..")) {
    throw new Error("FORBIDDEN");
  }

  const stackMatch = normalized.match(/^stack-preview\/([^/]+)\//);
  if (stackMatch) {
    const testId = stackMatch[1];
    const [test] = await db
      .select({ classId: tests.classId })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1);
    if (!test) throw new Error("FORBIDDEN");
    await requireClassAccess(test.classId, ["teacher"]);
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
    const teacher = await requireRole("teacher");
    const { segments } = await params;
    if (!segments?.length) {
      return NextResponse.json({ error: "File path is required." }, { status: 400 });
    }

    const storagePath = segments.join("/");
    await assertTeacherCanReadUpload(storagePath);

    const fullPath = path.join(UPLOAD_DIR, storagePath);
    if (!fullPath.startsWith(path.resolve(UPLOAD_DIR))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

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
