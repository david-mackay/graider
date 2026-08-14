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
  "application/x-pdf",
]);

export function isAllowedUploadPurpose(purpose: unknown): purpose is AllowedUploadPurpose {
  return purpose === "stack_preview";
}

export function isAllowedUploadContentType(contentType: string): boolean {
  return ALLOWED_UPLOAD_CONTENT_TYPES.has(contentType.toLowerCase());
}

/**
 * Browsers sometimes send an empty type or application/octet-stream for PDFs.
 * Guess from the filename so scanned PDFs aren't signed as JPEG.
 */
export function inferUploadContentType(
  filename: string | undefined,
  contentType?: string | null,
): string {
  const type = (contentType ?? "").trim().toLowerCase();
  if (
    type &&
    type !== "application/octet-stream" &&
    isAllowedUploadContentType(type)
  ) {
    return type === "application/x-pdf" ? "application/pdf" : type;
  }

  const lower = (filename ?? "").toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return type || "image/jpeg";
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
