import { OcrAnswer, OcrPage } from "@/lib/types";

export type GradeResult = {
  marks_earned: number;
  feedback: string;
};

type OpenRouterMessageContent = { type: "text" | "image_url"; text?: string; image_url?: { url: string } };
type OpenRouterMessage = { role: "system" | "user" | "assistant"; content: string | OpenRouterMessageContent[] };

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.OPENROUTER_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const APP_TITLE = "Graider AI";
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
const DEFAULT_VISION_MODEL = process.env.OPENROUTER_IMAGE_MODEL ?? process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

function assertOpenRouterKey() {
  if (!API_KEY) {
    throw new Error("OPENROUTER_API_KEY must be configured.");
  }
}

function parseJsonPayload(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/g, "")
      .trim();
    try {
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

async function callOpenRouter(messages: OpenRouterMessage[], model: string) {
  assertOpenRouterKey();

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      "HTTP-Referer": APP_URL,
      "X-Title": APP_TITLE,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as OpenRouterResponse;
  const content = payload.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonPayload(content);
  if (!parsed) {
    throw new Error("OpenRouter did not return valid JSON.");
  }
  return parsed;
}

export async function gradeQuestion(params: {
  question: string;
  marks: number;
  teacher_answer: string;
  student_answer: string;
}): Promise<GradeResult> {
  const prompt = `You are an exam grading assistant. Grade one question by comparing the student response to the teacher answer.\n\n` +
    `Question: ${params.question}\n` +
    `This question is worth ${params.marks} marks.\n` +
    `Teacher answer: ${params.teacher_answer}\n` +
    `Student answer: ${params.student_answer}\n\n` +
    `Return JSON only in this exact structure and keep marks between 0 and ${params.marks}:\n` +
    `{"marks_earned": number, "feedback": "short feedback based on teacher answer"}`;

  const parsed = await callOpenRouter(
    [
      {
        role: "system",
        content: "You are strict and consistent with numeric grading.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    DEFAULT_MODEL,
  );

  const marksRaw = Number(parsed.marks_earned);
  const marksEarned = Number.isFinite(marksRaw)
    ? Math.max(0, Math.min(params.marks, Math.round(marksRaw)))
    : 0;
  const feedback = typeof parsed.feedback === "string" ? parsed.feedback : "No feedback produced.";

  return {
    marks_earned: marksEarned,
    feedback,
  };
}

export async function extractHandwrittenAnswers(
  images: { filename: string; mimeType: string; base64: string }[],
): Promise<OcrAnswer[]> {
  if (images.length === 0) {
    return [];
  }

  const imageParts = images.map((entry) => ({
    type: "image_url" as const,
    image_url: {
      url: `data:${entry.mimeType};base64,${entry.base64}`,
    },
  }));

  const textPrompt = {
    type: "text" as const,
    text:
      "You are reading a photographed handwritten test. Read each question and corresponding answer exactly as written. " +
      "Return strict JSON with this shape: {\"answers\":[{\"question\":\"...\",\"answer\":\"...\",\"question_index\":0}]}. " +
      "question_index is optional and should be the position number if it appears on paper.",
  };

  const parsed = await callOpenRouter(
    [
      {
        role: "system",
        content: "You extract text from exam screenshots and output structured JSON.",
      },
      {
        role: "user",
        content: [textPrompt, ...imageParts],
      },
    ],
    DEFAULT_VISION_MODEL,
  );

  const raw = parsed.answers;
  if (!Array.isArray(raw)) {
    return [];
  }

  return (raw as unknown[])
    .map((entry): OcrAnswer | null => {
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof (entry as Record<string, unknown>).question !== "string" ||
        typeof (entry as Record<string, unknown>).answer !== "string"
      ) {
        return null;
      }
      const answerEntry = entry as { question?: string; answer?: string; question_index?: number };
      return {
        question: answerEntry.question ?? "",
        answer: answerEntry.answer ?? "",
        question_index:
          typeof answerEntry.question_index === "number" ? answerEntry.question_index : null,
      };
    })
    .filter((entry): entry is OcrAnswer => Boolean(entry && entry.question && entry.answer));
}

function coerceAnswerEntry(entry: unknown): OcrAnswer | null {
  if (typeof entry !== "object" || entry === null) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const question = typeof record.question === "string" ? record.question : "";
  const answer = typeof record.answer === "string" ? record.answer : "";
  if (!question && !answer) {
    return null;
  }
  const rawIndex = record.question_index;
  const questionIndex =
    typeof rawIndex === "number" && Number.isFinite(rawIndex) ? rawIndex : null;
  return {
    question,
    answer,
    question_index: questionIndex,
  };
}

export async function extractHandwrittenStack(
  images: { filename: string; mimeType: string; base64: string }[],
): Promise<OcrPage[]> {
  if (images.length === 0) {
    return [];
  }

  const imageParts = images.map((entry) => ({
    type: "image_url" as const,
    image_url: {
      url: `data:${entry.mimeType};base64,${entry.base64}`,
    },
  }));

  const textPrompt = {
    type: "text" as const,
    text:
      `You are reading ${images.length} photographed handwritten test paper${images.length === 1 ? "" : "s"}, ` +
      "one student per page. The pages are provided in order; treat each image as a separate page indexed starting at 0. " +
      "For each page do two things: (1) read the student's name written at the top of the paper (handwritten name field), " +
      "and (2) extract every question and the student's corresponding answer exactly as written. " +
      "Return strict JSON with this exact shape and one entry per image, in order: " +
      "{\"pages\":[{\"pageIndex\":0,\"studentName\":\"...\",\"confidence\":0.9," +
      "\"answers\":[{\"question\":\"...\",\"answer\":\"...\",\"question_index\":0}]}]}. " +
      "Rules for studentName and confidence: if the name is clearly printed and legible, use confidence 0.9 or higher. " +
      "If the handwriting is messy but you can make a reasonable guess, use confidence between 0.4 and 0.7. " +
      "If no name is visible or it is completely unreadable, return an empty string for studentName and confidence 0. " +
      "question_index is the position number written on the paper if visible, otherwise omit it or use null. " +
      "Always return exactly one entry in pages for each input image, even if a page is blank (return empty answers and empty studentName).",
  };

  const parsed = await callOpenRouter(
    [
      {
        role: "system",
        content:
          "You extract text from photographed handwritten exam pages and output strict JSON only. Never include commentary outside the JSON.",
      },
      {
        role: "user",
        content: [textPrompt, ...imageParts],
      },
    ],
    DEFAULT_VISION_MODEL,
  );

  const rawPages = (parsed as Record<string, unknown>).pages;
  const pageEntries = Array.isArray(rawPages) ? rawPages : [];

  return images.map((_image, index): OcrPage => {
    const candidate = pageEntries[index];
    if (typeof candidate !== "object" || candidate === null) {
      return {
        pageIndex: index,
        studentNameGuess: "",
        confidence: 0,
        answers: [],
      };
    }

    const record = candidate as Record<string, unknown>;
    const studentNameGuess =
      typeof record.studentName === "string" ? record.studentName.trim() : "";

    const confidenceRaw = Number(record.confidence);
    let confidence = Number.isFinite(confidenceRaw) ? confidenceRaw : 0;
    if (confidence < 0) confidence = 0;
    if (confidence > 1) confidence = 1;

    const rawAnswers = record.answers;
    const answers = Array.isArray(rawAnswers)
      ? (rawAnswers as unknown[])
          .map((entry) => coerceAnswerEntry(entry))
          .filter((entry): entry is OcrAnswer => entry !== null)
      : [];

    return {
      pageIndex: index,
      studentNameGuess,
      confidence: studentNameGuess ? confidence : 0,
      answers,
    };
  });
}
