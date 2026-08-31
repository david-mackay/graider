import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { extractAnswerKeyQuestions, isReductoConfigured } from "@/lib/reducto";
import { coerceParsePreset } from "@/lib/parse-presets";
import { checkRateLimit } from "@/lib/onboarding/rate-limit";
import { ONBOARDING_MAX_ANSWER_KEYS } from "@/lib/onboarding/types";
import type { ParsedImportQuestion } from "@/lib/types";
import { ndjsonStreamResponse, wantsNdjsonProgress } from "@/lib/http/ndjson-progress";

export const runtime = "nodejs";
// Reducto OCR + extract can take a while; avoid Vercel HTML timeouts that break res.json().
export const maxDuration = 120;

// Vercel caps request bodies around 4.5 MB before the handler runs, so keep the
// client-facing limit below that to return JSON instead of an HTML 413.
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 10;
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
 * Best-effort prefill via Reducto (PDF + photos) for the editable review screen.
 */
export async function POST(request: NextRequest) {
  if (!isReductoConfigured()) {
    return NextResponse.json(
      { error: "Answer-key import is temporarily unavailable.", questions: [] },
      { status: 503 },
    );
  }

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

  const uploads: { buffer: Buffer; filename: string; mimeType: string }[] = [];
  let imageCount = 0;
  let pdfCount = 0;

  for (const [field, value] of form.entries()) {
    if (field !== "pdf" && field !== "pdfs" && field !== "image") continue;
    if (!isBlobBody(value)) continue;

    const filename =
      typeof File !== "undefined" && value instanceof File && value.name
        ? value.name
        : field === "image"
          ? `key-${imageCount + 1}.png`
          : `answer-key-${pdfCount + 1}.pdf`;
    const isPdfField = field === "pdf" || field === "pdfs";
    const looksPdf =
      value.type === "application/pdf" ||
      value.type === "application/x-pdf" ||
      filename.toLowerCase().endsWith(".pdf");

    if (isPdfField) {
      if (value.type && !looksPdf) {
        return NextResponse.json({ error: "Upload a PDF answer key." }, { status: 400 });
      }
      const arrayBuffer = await value.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_PDF_BYTES) {
        return NextResponse.json(
          { error: "Each PDF must be under 4 MB, or add the key manually." },
          { status: 413 },
        );
      }
      pdfCount += 1;
      uploads.push({
        buffer: Buffer.from(arrayBuffer),
        filename,
        mimeType: "application/pdf",
      });
      continue;
    }

    const arrayBuffer = await value.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Each image must be under 4 MB." },
        { status: 413 },
      );
    }
    const mimeType = value.type || "image/jpeg";
    if (!mimeType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Upload image files (JPG or PNG) or a PDF." },
        { status: 400 },
      );
    }
    imageCount += 1;
    uploads.push({
      buffer: Buffer.from(arrayBuffer),
      filename,
      mimeType,
    });
  }

  if (uploads.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Upload at most ${MAX_FILES} files at a time.` },
      { status: 400 },
    );
  }

  if (uploads.length === 0) {
    return NextResponse.json(
      { error: "Upload a PDF or photo of your answer key." },
      { status: 400 },
    );
  }

  try {
    const sourceIsVision = uploads.every((u) => u.mimeType.startsWith("image/"));
    const preset = coerceParsePreset(
      form.get("parsePreset")?.toString(),
      sourceIsVision ? "answer_key_photo" : "answer_key_pdf",
    );
    const stream = wantsNdjsonProgress(request);

    const runExtract = async (onProgress?: (percent: number, label: string) => void) => {
      const parsed = await extractAnswerKeyQuestions(uploads, preset, (progress) => {
        onProgress?.(progress.percent, progress.label);
      });
      const questions = mapQuestions(parsed);
      const source = sourceIsVision ? "vision" : "reducto";
      if (questions.length === 0) {
        return {
          ok: false as const,
          status: 422,
          body: {
            error:
              "We couldn't prefill from that file. Tweak the review below, or try a clearer photo.",
            questions: [],
            needsPhoto: source !== "vision",
          },
        };
      }
      return {
        ok: true as const,
        status: 200,
        body: {
          questions,
          truncated: parsed.length > ONBOARDING_MAX_ANSWER_KEYS,
          totalFound: parsed.length,
          source,
        },
      };
    };

    if (stream) {
      return ndjsonStreamResponse(async (emit) => {
        emit({ type: "progress", percent: 0, label: "Files received" });
        try {
          const outcome = await runExtract((percent, label) => {
            emit({ type: "progress", percent, label });
          });
          if (!outcome.ok) {
            emit({ type: "error", status: outcome.status, ...outcome.body });
            return;
          }
          emit({ type: "progress", percent: 100, label: "Done" });
          emit({ type: "result", ...outcome.body });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not read that answer key.";
          const status = /not configured|missing REDUCTO/i.test(message)
            ? 503
            : /no questions|could not read|could not extract|upload a pdf/i.test(message)
              ? 422
              : 502;
          emit({ type: "error", status, error: message, questions: [] });
        }
      });
    }

    const outcome = await runExtract();
    if (!outcome.ok) {
      return NextResponse.json(outcome.body, { status: outcome.status });
    }
    return NextResponse.json(outcome.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read that answer key.";
    const status = /not configured|missing REDUCTO/i.test(message)
      ? 503
      : /no questions|could not read|could not extract|upload a pdf/i.test(message)
        ? 422
        : 502;
    return NextResponse.json({ error: message, questions: [] }, { status });
  }
}
