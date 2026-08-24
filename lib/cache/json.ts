import { cacheGet, cacheSet } from "@/lib/cache/redis";

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const cached = await cacheGet(key);
  if (!cached) return null;
  try {
    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await cacheSet(key, JSON.stringify(value), ttlSeconds);
}

export async function getOrSetJson<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGetJson<T>(key);
  if (cached !== null) return cached;
  const value = await load();
  await cacheSetJson(key, value, ttlSeconds);
  return value;
}
