export const ALL_CLASSES_VALUE = "__all__";

export function normalizeTopic(topic: string | null | undefined): string {
  const trimmed = topic?.trim();
  return trimmed ? trimmed : "General";
}

export async function handleJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();

  if (!contentType.includes("application/json")) {
    if (response.status === 413 || /^Request Entity/i.test(raw)) {
      throw new Error(
        "Upload too large for one request. Send fewer pages at a time (one student works best).",
      );
    }
    throw new Error(
      response.ok
        ? "Unexpected non-JSON response from server."
        : raw.trim().slice(0, 160) || `Request failed (${response.status}).`,
    );
  }

  let payload: { error?: string; code?: string; [key: string]: unknown };
  try {
    payload = JSON.parse(raw) as { error?: string; code?: string; [key: string]: unknown };
  } catch {
    if (response.status === 413 || /^Request Entity/i.test(raw)) {
      throw new Error(
        "Upload too large for one request. Send fewer pages at a time (one student works best).",
      );
    }
    throw new Error(raw.trim().slice(0, 160) || "Unexpected response from server.");
  }

  if (!response.ok) {
    const err = new Error(payload.error ?? "Unexpected error") as Error & { code?: string };
    if (typeof payload.code === "string") err.code = payload.code;
    throw err;
  }
  return payload as T;
}

export type StatusType = "info" | "error";

export type AttemptAnswerPayload = { question_id: string; answer: string };
