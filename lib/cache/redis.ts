import Redis from "ioredis";

let client: Redis | null | undefined;

function getCacheClient(): Redis | null {
  if (client !== undefined) return client;

  const url = process.env.REDIS_URL;
  if (!url) {
    client = null;
    return client;
  }

  try {
    client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    client.on("error", () => {
      // Soft-fail: callers treat cache as optional.
    });
  } catch {
    client = null;
  }

  return client;
}

async function withClient<T>(fn: (redis: Redis) => Promise<T>): Promise<T | null> {
  const redis = getCacheClient();
  if (!redis) return null;

  try {
    if (redis.status === "wait" || redis.status === "end") {
      await redis.connect();
    }
    return await fn(redis);
  } catch {
    return null;
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  return (await withClient((redis) => redis.get(key))) ?? null;
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  await withClient((redis) => redis.set(key, value, "EX", ttlSeconds));
}

export async function cacheDel(key: string): Promise<void> {
  await withClient((redis) => redis.del(key));
}

export async function cacheDelMany(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await withClient((redis) => redis.del(...keys));
}
