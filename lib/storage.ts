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

function usesObjectStorage(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
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
