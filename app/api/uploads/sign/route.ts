import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { tests } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { createSignedUpload, usesObjectStorage } from "@/lib/storage";
import { MAX_PAGES_PER_STUDENT } from "@/lib/student-grade";

export const runtime = "nodejs";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB — scanned PDFs can be large

type SignFileInput = {
  filename?: string;
  contentType?: string;
  size?: number;
};

type SignPayload = {
  purpose?: string;
  testId?: string;
  classId?: string;
  files?: SignFileInput[];
};

function normalizeImageName(fileName: string | undefined) {
  if (!fileName) return `upload-${Date.now()}`;
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 80);
}

function extensionFor(filename: string | undefined, contentType: string): string {
  const fromName = filename?.match(/(\.[a-zA-Z0-9]+)$/)?.[1];
  if (fromName) return fromName.toLowerCase();
  if (contentType === "application/pdf") return ".pdf";
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/heic" || contentType === "image/heif") return ".heic";
  return ".jpg";
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await requireRole("teacher");

    if (!usesObjectStorage()) {
      return NextResponse.json(
        {
          error: "Direct uploads require Supabase Storage.",
          code: "OBJECT_STORAGE_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as SignPayload;
    if (body.purpose !== "stack_preview") {
      return NextResponse.json({ error: "Unsupported upload purpose." }, { status: 400 });
    }

    const testId = body.testId?.trim();
    if (!testId) {
      return NextResponse.json({ error: "testId is required." }, { status: 400 });
    }

    const files = Array.isArray(body.files) ? body.files : [];
    if (files.length === 0) {
      return NextResponse.json({ error: "At least one file is required." }, { status: 400 });
    }
    if (files.length > MAX_PAGES_PER_STUDENT) {
      return NextResponse.json(
        { error: `Too many files. Max ${MAX_PAGES_PER_STUDENT} per request.` },
        { status: 400 },
      );
    }

    const [test] = await db
      .select({ id: tests.id, classId: tests.classId })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1);

    if (!test) {
      return NextResponse.json({ error: "Test not found." }, { status: 404 });
    }

    await requireClassAccess(test.classId, ["teacher"]);

    if (body.classId && body.classId !== test.classId) {
      return NextResponse.json({ error: "classId does not match test." }, { status: 400 });
    }

    const stamp = Date.now();
    const uploads: Array<{
      path: string;
      token: string;
      signedUrl: string;
      bucket: string;
      contentType: string;
      filename: string;
    }> = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const contentType = (file.contentType || "image/jpeg").toLowerCase();
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        return NextResponse.json(
          { error: `Unsupported content type: ${contentType}` },
          { status: 400 },
        );
      }
      if (typeof file.size === "number" && (file.size <= 0 || file.size > MAX_FILE_BYTES)) {
        return NextResponse.json(
          { error: `Each page must be between 1 byte and ${MAX_FILE_BYTES} bytes.` },
          { status: 400 },
        );
      }

      const filename = file.filename?.trim() || `page-${index + 1}.jpg`;
      const ext = extensionFor(filename, contentType);
      const safeBase = normalizeImageName(filename.replace(/\.[^.]+$/, "") || `page-${index + 1}`);
      const pathKey = `stack-preview/${testId}/${stamp}-${teacher.id.slice(0, 8)}-${index}-${safeBase}${ext}`;

      const signed = await createSignedUpload(pathKey);
      uploads.push({
        path: signed.path,
        token: signed.token,
        signedUrl: signed.signedUrl,
        bucket: signed.bucket,
        contentType,
        filename,
      });
    }

    return NextResponse.json({ uploads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
