import { listPushTokensForUser } from "@/lib/push-tokens/repository";

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

type ExpoPushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/** Send a push notification to every registered device for a user. */
export async function sendPushToUser(userId: string, message: PushMessage): Promise<void> {
  const tokens = await listPushTokensForUser(userId);
  if (tokens.length === 0) return;

  const payloads = tokens.map((token) => ({
    to: token.expoPushToken,
    title: message.title,
    body: message.body,
    data: message.data,
    sound: "default" as const,
  }));

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  for (const batch of chunk(payloads, 100)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[push] Expo API error:", response.status, text);
      continue;
    }

    const body = (await response.json()) as { data?: ExpoPushTicket[] };
    for (const ticket of body.data ?? []) {
      if (ticket.status === "error") {
        console.warn("[push] ticket error:", ticket.message, ticket.details);
      }
    }
  }
}
