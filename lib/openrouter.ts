export type GradeResult = {
  marks_earned: number;
  feedback: string;
};

type OpenRouterMessage = { role: "system" | "user" | "assistant"; content: string };

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.OPENROUTER_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const APP_TITLE = "Graider AI";
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

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
  const prompt =
    `You are an exam grading assistant. Grade one question by comparing the student response to the teacher answer.\n\n` +
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
