export const ALLOWED_UPLOAD_PURPOSES = ["stack_preview"] as const;
export type AllowedUploadPurpose = (typeof ALLOWED_UPLOAD_PURPOSES)[number];

export const ALLOWED_UPLOAD_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export function isAllowedUploadPurpose(purpose: unknown): purpose is AllowedUploadPurpose {
  return purpose === "stack_preview";
}

export function isAllowedUploadContentType(contentType: string): boolean {
  return ALLOWED_UPLOAD_CONTENT_TYPES.has(contentType);
}

/** Reject path traversal and empty paths (UP-04). */
export function assertSafeStoragePath(storagePath: string): { ok: true } | { ok: false; reason: string } {
  const normalized = storagePath.replace(/^\/+/, "");
  if (!normalized) {
    return { ok: false, reason: "File path is required." };
  }
  if (normalized.includes("..")) {
    return { ok: false, reason: "FORBIDDEN" };
  }
  return { ok: true };
}
