import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { tests } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { uploadFile } from "@/lib/storage";
import { MAX_PDF_BYTES } from "@/lib/content-import-jobs/constants";
import {
  createContentImportJob,
  setContentImportBullmqJobId,
} from "@/lib/content-import-jobs/repository";
import { enqueueTestImportJob } from "@/lib/content-import-jobs/queue";
import { coerceParsePreset } from "@/lib/parse-presets";

export const runtime = "nodejs";

type Params = { classId: string };
type RouteContext = { params: Params | Promise<Params> };

function isFileLike(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function collectPdfFiles(form: FormData): File[] {
  const files: File[] = [];
  for (const value of form.getAll("pdf")) {
    if (isFileLike(value)) files.push(value);
  }
  for (const value of form.getAll("pdfs")) {
    if (isFileLike(value)) files.push(value);
  }
  return files;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { classId } = await params;
    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    const teacher = await requireClassAccess(classId, ["teacher"]);
    const form = await request.formData();
    const files = collectPdfFiles(form);

    if (files.length === 0) {
      return NextResponse.json({ error: "At least one PDF file is required." }, { status: 400 });
    }

    for (const file of files) {
      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json({ error: `PDF is too large: ${file.name}` }, { status: 400 });
      }
      if (file.type && file.type !== "application/pdf") {
        return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
      }
    }

    const targetTestId = form.get("targetTestId")?.toString()?.trim() || null;
    if (targetTestId) {
      const [target] = await db
        .select({ id: tests.id })
        .from(tests)
        .where(
          and(
            eq(tests.id, targetTestId),
            eq(tests.classId, classId),
            eq(tests.teacherId, teacher.id),
          ),
        )
        .limit(1);
      if (!target) {
        return NextResponse.json({ error: "Target test not found in this class." }, { status: 404 });
      }
    }

    const storagePaths: string[] = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const storagePath = `imports/${classId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, "-")}`;
      await uploadFile(storagePath, buffer, "application/pdf");
      storagePaths.push(storagePath);
    }

    const parsePreset = coerceParsePreset(form.get("parsePreset")?.toString(), "test_import");
    const [primary, ...extra] = storagePaths;

    const job = await createContentImportJob({
      kind: "test",
      classId,
      teacherId: teacher.id,
      storagePath: primary!,
      extraStoragePaths: extra,
      targetTestId,
      parsePreset,
    });

    const bullmqJobId = await enqueueTestImportJob(job.id);
    await setContentImportBullmqJobId(job.id, bullmqJobId);

    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : message.includes("REDIS_URL")
            ? 503
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
