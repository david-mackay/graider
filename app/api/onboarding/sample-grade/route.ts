import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { extractHandwrittenAnswers, gradeQuestion } from "@/lib/openrouter";
import { checkRateLimit } from "@/lib/onboarding/rate-limit";
import type { SampleGradeResponse } from "@/lib/types";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function isFileLike(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
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

type AnswerKey = { prompt: string; correctAnswer: string; marks: number };

function parseAnswerKey(raw: string | null): { value?: AnswerKey; error?: string } {
  if (!raw) {
    return { error: "Invalid answer key." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Invalid answer key." };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { error: "Invalid answer key." };
  }
  const record = parsed as Record<string, unknown>;
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  const correctAnswer =
    typeof record.correctAnswer === "string" ? record.correctAnswer.trim() : "";
  const marksRaw = record.marks;

  if (!prompt) {
    return { error: "Answer key is missing prompt." };
  }
  if (!correctAnswer) {
    return { error: "Answer key is missing correctAnswer." };
  }
  if (
    typeof marksRaw !== "number" ||
    !Number.isFinite(marksRaw) ||
    !Number.isInteger(marksRaw) ||
    marksRaw <= 0
  ) {
    return { error: "Answer key marks must be a positive integer." };
  }

  return { value: { prompt, correctAnswer, marks: marksRaw } };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(ip, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    const retryAfterSeconds = Math.ceil(limit.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "You've hit the free demo quota. Sign up to keep grading." },
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
    return NextResponse.json({ error: "An image is required." }, { status: 400 });
  }

  const imageInput = form.get("image");
  if (!imageInput || !isFileLike(imageInput)) {
    return NextResponse.json({ error: "An image is required." }, { status: 400 });
  }

  const arrayBuffer = await imageInput.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image must be under 8 MB." },
      { status: 413 },
    );
  }

  const mimeType = imageInput.type || "";
  if (!mimeType.startsWith("image/")) {
    return NextResponse.json(
      { error: "Upload an image file (JPG or PNG)." },
      { status: 400 },
    );
  }

  const answerKeyRaw = form.get("answerKey");
  const answerKeyParsed = parseAnswerKey(
    typeof answerKeyRaw === "string" ? answerKeyRaw : null,
  );
  if (answerKeyParsed.error || !answerKeyParsed.value) {
    return NextResponse.json(
      { error: answerKeyParsed.error ?? "Invalid answer key." },
      { status: 400 },
    );
  }
  const answerKey = answerKeyParsed.value;

  const buffer = Buffer.from(arrayBuffer);
  const imagePayload = {
    filename: imageInput.name || "sample.png",
    mimeType,
    base64: buffer.toString("base64"),
  };

  try {
    const answers = await extractHandwrittenAnswers([imagePayload]);

    if (answers.length === 0) {
      const softFail: SampleGradeResponse = {
        marksEarned: 0,
        maxMarks: answerKey.marks,
        feedback: "We couldn't read the answer — try a clearer photo.",
        ocrAnswerText: "",
      };
      return NextResponse.json(softFail, { status: 200 });
    }

    const studentAnswer = answers[0].answer;

    const result = await gradeQuestion({
      question: answerKey.prompt,
      marks: answerKey.marks,
      teacher_answer: answerKey.correctAnswer,
      student_answer: studentAnswer,
    });

    const response: SampleGradeResponse = {
      marksEarned: result.marks_earned,
      maxMarks: answerKey.marks,
      feedback: result.feedback,
      ocrAnswerText: studentAnswer,
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "We're having trouble grading right now — please try again." },
      { status: 502 },
    );
  }
}
