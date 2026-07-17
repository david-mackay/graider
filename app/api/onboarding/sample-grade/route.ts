import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { extractHandwrittenAnswers, gradeQuestion } from "@/lib/openrouter";
import { checkRateLimit } from "@/lib/onboarding/rate-limit";
import type { OnboardingAnswerKey, OnboardingQuestionGrade } from "@/lib/onboarding/types";
import type { SampleGradeResponse } from "@/lib/types";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function isImageBody(value: unknown): value is Blob {
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

function parseOneKey(record: Record<string, unknown>): OnboardingAnswerKey | null {
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  const correctAnswer =
    typeof record.correctAnswer === "string"
      ? record.correctAnswer.trim()
      : typeof record.correct_answer === "string"
        ? record.correct_answer.trim()
        : "";
  const marksRaw = record.marks;
  if (!prompt || !correctAnswer) return null;
  if (
    typeof marksRaw !== "number" ||
    !Number.isFinite(marksRaw) ||
    !Number.isInteger(marksRaw) ||
    marksRaw <= 0
  ) {
    return null;
  }
  return { prompt, correctAnswer, marks: marksRaw };
}

function parseAnswerKeys(raw: string | null): { value?: OnboardingAnswerKey[]; error?: string } {
  if (!raw) return { error: "Invalid answer key." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Invalid answer key." };
  }

  if (Array.isArray(parsed)) {
    const keys = parsed
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      .map(parseOneKey)
      .filter((entry): entry is OnboardingAnswerKey => Boolean(entry));
    if (keys.length === 0) return { error: "Answer key is missing questions." };
    return { value: keys };
  }

  if (typeof parsed === "object" && parsed !== null) {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.questions)) {
      return parseAnswerKeys(JSON.stringify(record.questions));
    }
    const single = parseOneKey(record);
    if (!single) return { error: "Invalid answer key." };
    return { value: [single] };
  }

  return { error: "Invalid answer key." };
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
  if (!imageInput || !isImageBody(imageInput)) {
    return NextResponse.json({ error: "An image is required." }, { status: 400 });
  }

  const arrayBuffer = await imageInput.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be under 8 MB." }, { status: 413 });
  }

  const mimeType = imageInput.type || "";
  if (!mimeType.startsWith("image/")) {
    return NextResponse.json({ error: "Upload an image file (JPG or PNG)." }, { status: 400 });
  }

  const answerKeyRaw = form.get("answerKey");
  const answerKeysRaw = form.get("answerKeys");
  const answerKeyParsed = parseAnswerKeys(
    typeof answerKeysRaw === "string"
      ? answerKeysRaw
      : typeof answerKeyRaw === "string"
        ? answerKeyRaw
        : null,
  );
  if (answerKeyParsed.error || !answerKeyParsed.value) {
    return NextResponse.json(
      { error: answerKeyParsed.error ?? "Invalid answer key." },
      { status: 400 },
    );
  }
  const answerKeys = answerKeyParsed.value;
  const maxMarks = answerKeys.reduce((sum, key) => sum + key.marks, 0);

  const buffer = Buffer.from(arrayBuffer);
  const filename =
    typeof File !== "undefined" && imageInput instanceof File && imageInput.name
      ? imageInput.name
      : "sample.png";
  const imagePayload = {
    filename,
    mimeType,
    base64: buffer.toString("base64"),
  };

  try {
    const answers = await extractHandwrittenAnswers([imagePayload]);

    if (answers.length === 0) {
      const softFail: SampleGradeResponse = {
        marksEarned: 0,
        maxMarks,
        feedback: "We couldn't read the answer — try a clearer photo.",
        ocrAnswerText: "",
        questions: answerKeys.map((key) => ({
          prompt: key.prompt,
          marksEarned: 0,
          maxMarks: key.marks,
          feedback: "Couldn't read this answer.",
          ocrAnswerText: "",
        })),
      };
      return NextResponse.json(softFail, { status: 200 });
    }

    const questionGrades: OnboardingQuestionGrade[] = [];
    for (let index = 0; index < answerKeys.length; index += 1) {
      const key = answerKeys[index];
      const studentAnswer =
        answers.find((a) => a.question_index === index)?.answer ??
        answers[index]?.answer ??
        "";

      if (!studentAnswer.trim()) {
        questionGrades.push({
          prompt: key.prompt,
          marksEarned: 0,
          maxMarks: key.marks,
          feedback: "No answer found for this question.",
          ocrAnswerText: "",
        });
        continue;
      }

      const result = await gradeQuestion({
        question: key.prompt,
        marks: key.marks,
        teacher_answer: key.correctAnswer,
        student_answer: studentAnswer,
      });

      questionGrades.push({
        prompt: key.prompt,
        marksEarned: result.marks_earned,
        maxMarks: key.marks,
        feedback: result.feedback,
        ocrAnswerText: studentAnswer,
      });
    }

    const marksEarned = questionGrades.reduce((sum, q) => sum + q.marksEarned, 0);
    const feedback =
      questionGrades.length === 1
        ? questionGrades[0].feedback
        : questionGrades.map((q, i) => `Q${i + 1}: ${q.feedback}`).join(" ");

    const response: SampleGradeResponse = {
      marksEarned,
      maxMarks,
      feedback,
      ocrAnswerText: questionGrades.map((q) => q.ocrAnswerText).filter(Boolean).join("\n\n"),
      questions: questionGrades,
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "We're having trouble grading right now — please try again." },
      { status: 502 },
    );
  }
}
