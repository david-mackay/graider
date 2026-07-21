import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { extractPdfTextAssessmentFromBuffer } from "@/lib/content-import-jobs/extract-pdf";
import {
  parseAnswerKeyFromImages,
  parseQuestionBankFromText,
} from "@/lib/openrouter";
import { checkRateLimit } from "@/lib/onboarding/rate-limit";
import { ONBOARDING_MAX_ANSWER_KEYS } from "@/lib/onboarding/types";
import type { ParsedImportQuestion } from "@/lib/types";

export const runtime = "nodejs";
// PDF text extraction + LLM question parsing can take a while; the default
// function timeout returns an HTML error page that breaks the client's res.json().
export const maxDuration = 60;

// Vercel caps request bodies around 4.5 MB before the handler runs, so keep the
// client-facing limit below that to return JSON instead of an HTML 413.
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function isBlobBody(value: unknown): value is Blob {
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

function mapQuestions(parsed: ParsedImportQuestion[]) {
  return parsed.slice(0, ONBOARDING_MAX_ANSWER_KEYS).map((q) => ({
    prompt: q.prompt,
    correctAnswer: q.correct_answer,
    marks: Math.max(1, q.marks || 1),
    questionType: q.question_type === "mcq" ? "mcq" : "open",
    choices: q.choices ?? null,
  }));
}

/**
 * Public, ephemeral answer-key parse for the onboarding demo.
 * Best-effort prefill for the editable review screen — PDF text and/or photos.
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
    return NextResponse.json(
      { error: "Upload a PDF or photo of your answer key." },
      { status: 400 },
    );
  }

  const pdfInput = form.get("pdf");
  const imageInputs = form.getAll("image").filter(isBlobBody) as Blob[];

  const imagePayloads: { filename: string; mimeType: string; base64: string }[] = [];
  for (let i = 0; i < imageInputs.length; i++) {
    const img = imageInputs[i];
    const arrayBuffer = await img.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Each image must be under 4 MB." },
        { status: 413 },
      );
    }
    const mimeType = img.type || "";
    if (!mimeType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Upload image files (JPG or PNG) or a PDF." },
        { status: 400 },
      );
    }
    const filename =
      typeof File !== "undefined" && img instanceof File && img.name
        ? img.name
        : `key-${i + 1}.png`;
    imagePayloads.push({
      filename,
      mimeType,
      base64: Buffer.from(arrayBuffer).toString("base64"),
    });
  }

  // Photos: vision path immediately (covers circled / scanned keys).
  if (imagePayloads.length > 0 && (!pdfInput || !isBlobBody(pdfInput))) {
    try {
      const parsed = await parseAnswerKeyFromImages(imagePayloads);
      const questions = mapQuestions(parsed);
      return NextResponse.json({
        questions,
        truncated: parsed.length > ONBOARDING_MAX_ANSWER_KEYS,
        totalFound: parsed.length,
        source: "vision",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not read those photos.";
      return NextResponse.json({ error: message, questions: [] }, { status: 422 });
    }
  }

  if (!pdfInput || !isBlobBody(pdfInput)) {
    return NextResponse.json(
      { error: "Upload a PDF or photo of your answer key." },
      { status: 400 },
    );
  }

  const arrayBuffer = await pdfInput.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: "PDF is too large. Keep it under 4 MB, or add the key manually." },
      { status: 413 },
    );
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
    const assessment = await extractPdfTextAssessmentFromBuffer(Buffer.from(arrayBuffer));

    if (assessment.usable) {
      try {
        const parsed = await parseQuestionBankFromText(assessment.text);
        const questions = mapQuestions(parsed);
        if (questions.length > 0) {
          return NextResponse.json({
            questions,
            truncated: parsed.length > ONBOARDING_MAX_ANSWER_KEYS,
            totalFound: parsed.length,
            source: "text",
          });
        }
      } catch {
        // Fall through to vision / soft guidance.
      }
    }

    // PDF had no usable text (or text parse found nothing). Prefer photos if provided.
    if (imagePayloads.length > 0) {
      const parsed = await parseAnswerKeyFromImages(imagePayloads);
      const questions = mapQuestions(parsed);
      return NextResponse.json({
        questions,
        truncated: parsed.length > ONBOARDING_MAX_ANSWER_KEYS,
        totalFound: parsed.length,
        source: "vision",
      });
    }

    return NextResponse.json(
      {
        error:
          "This PDF looks scanned or has no readable text. Photograph the answer key (especially if answers are circled) and upload the photo, or add questions in review.",
        questions: [],
        needsPhoto: true,
      },
      { status: 422 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read that PDF.";
    const status = /no questions|could not extract|could not read/i.test(message) ? 422 : 502;
    return NextResponse.json({ error: message, questions: [] }, { status });
  }
}
