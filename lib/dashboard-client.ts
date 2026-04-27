export const ALL_CLASSES_VALUE = "__all__";

export function normalizeTopic(topic: string | null | undefined): string {
  const trimmed = topic?.trim();
  return trimmed ? trimmed : "General";
}

export async function handleJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as { error?: string; [key: string]: unknown };
  if (!response.ok) throw new Error(payload.error ?? "Unexpected error");
  return payload as T;
}

export type StatusType = "info" | "error";

export type AttemptAnswerPayload = { question_id: string; answer: string };
