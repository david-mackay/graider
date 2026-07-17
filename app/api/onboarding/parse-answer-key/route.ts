import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { extractPdfTextFromBuffer } from "@/lib/content-import-jobs/extract-pdf";
import { parseQuestionBankFromText } from "@/lib/openrouter";
import { checkRateLimit } from "@/lib/onboarding/rate-limit";
import { ONBOARDING_MAX_ANSWER_KEYS } from "@/lib/onboarding/types";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 12 * 1024 * 1024;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function isPdfBody(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * Public, ephemeral answer-key PDF parse for the onboarding demo.
 * No auth, no DB — returns structured questions for the local vault only.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`parse-key:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    const retryAfterSeconds = Math.ceil(limit.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "You've hit the free demo quota. Sign up to keep importing." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "A PDF is required." }, { status: 400 });
  }

  const pdfInput = form.get("pdf");
  if (!pdfInput || !isPdfBody(pdfInput)) {
    return NextResponse.json({ error: "A PDF is required." }, { status: 400 });
  }

  const arrayBuffer = await pdfInput.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "PDF must be under 12 MB." }, { status: 413 });
  }

  const mimeType = pdfInput.type || "";
  const filename =
    typeof File !== "undefined" && pdfInput instanceof File && pdfInput.name
      ? pdfInput.name
      : "answer-key.pdf";
  if (mimeType && mimeType !== "application/pdf" && !filename.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Upload a PDF answer key." }, { status: 400 });
  }

  try {
    const text = await extractPdfTextFromBuffer(Buffer.from(arrayBuffer));
    const parsed = await parseQuestionBankFromText(text);
    const questions = parsed.slice(0, ONBOARDING_MAX_ANSWER_KEYS).map((q) => ({
      prompt: q.prompt,
      correctAnswer: q.correct_answer,
      marks: Math.max(1, q.marks || 1),
    }));

    return NextResponse.json({
      questions,
      truncated: parsed.length > ONBOARDING_MAX_ANSWER_KEYS,
      totalFound: parsed.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read that PDF.";
    const status = /no questions|could not extract/i.test(message) ? 422 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
