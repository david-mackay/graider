import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
const DEFAULT_BUCKET = "test-uploads";

function normalizeKey(filePath: string): string {
  const normalized = filePath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!normalized || normalized.includes("..") || path.isAbsolute(filePath)) {
    throw new Error("Invalid storage path");
  }
  return normalized;
}

function getBucket(): string {
  return process.env.SUPABASE_TEST_UPLOAD_BUCKET?.trim() || DEFAULT_BUCKET;
}

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function usesObjectStorage(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function getStorageBucket(): string {
  return getBucket();
}

export async function uploadFile(
  filePath: string,
  buffer: Buffer,
  contentType?: string,
): Promise<void> {
  const key = normalizeKey(filePath);
  const supabase = getSupabase();

  if (supabase) {
    const { error } = await supabase.storage.from(getBucket()).upload(key, buffer, {
      contentType: contentType || "application/octet-stream",
      upsert: true,
    });
    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }
    return;
  }

  const fullPath = path.join(UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
}

export type SignedUploadTarget = {
  path: string;
  token: string;
  signedUrl: string;
  bucket: string;
};

/** Short-lived signed upload URL for direct browser → Supabase uploads. */
export async function createSignedUpload(filePath: string): Promise<SignedUploadTarget> {
  const key = normalizeKey(filePath);
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Object storage is not configured.");
  }

  const bucket = getBucket();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(key, {
    upsert: true,
  });
  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message ?? "unknown error"}`);
  }

  return {
    path: data.path || key,
    token: data.token,
    signedUrl: data.signedUrl,
    bucket,
  };
}

export async function objectExists(filePath: string): Promise<boolean> {
  const key = normalizeKey(filePath);
  const supabase = getSupabase();

  if (supabase) {
    const dir = path.posix.dirname(key);
    const name = path.posix.basename(key);
    const { data, error } = await supabase.storage.from(getBucket()).list(dir === "." ? "" : dir, {
      limit: 1000,
    });
    if (error) return false;
    return (data ?? []).some((entry) => entry.name === name);
  }

  try {
    await fs.access(path.join(UPLOAD_DIR, key));
    return true;
  } catch {
    return false;
  }
}

export async function getFilePath(filePath: string): Promise<string> {
  if (usesObjectStorage()) {
    throw new Error("getFilePath is unavailable when using Supabase Storage");
  }
  return path.join(UPLOAD_DIR, normalizeKey(filePath));
}

export async function readFile(filePath: string): Promise<Buffer> {
  const key = normalizeKey(filePath);
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase.storage.from(getBucket()).download(key);
    if (error || !data) {
      throw new Error(`Storage download failed: ${error?.message ?? "file not found"}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  return fs.readFile(path.join(UPLOAD_DIR, key));
}
