import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { requireClassAccess } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import { MAX_PDF_BYTES } from "@/lib/content-import-jobs/constants";
import {
  createContentImportJob,
  setContentImportBullmqJobId,
} from "@/lib/content-import-jobs/repository";
import { enqueueQuestionBankImportJob } from "@/lib/content-import-jobs/queue";

export const runtime = "nodejs";

type Params = { classId: string };
type RouteContext = { params: Params | Promise<Params> };

function isFileLike(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { classId } = await params;
    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    const teacher = await requireClassAccess(classId, ["teacher"]);
    const form = await request.formData();
    const file = form.get("pdf");

    if (!isFileLike(file)) {
      return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "PDF is too large." }, { status: 400 });
    }
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `imports/${classId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, "-")}`;
    await uploadFile(storagePath, buffer, "application/pdf");

    const job = await createContentImportJob({
      kind: "question_bank",
      classId,
      teacherId: teacher.id,
      storagePath,
    });

    const bullmqJobId = await enqueueQuestionBankImportJob(job.id);
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
