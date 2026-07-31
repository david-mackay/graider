import { handleJson } from "@/lib/dashboard-client";

export type SignedUploadSlot = {
  path: string;
  token: string;
  signedUrl: string;
  bucket: string;
  contentType: string;
  filename: string;
};

export type DirectUploadResult = {
  storagePaths: string[];
  imageMeta: { filename: string; mimeType: string }[];
};

/**
 * Ask the API for signed upload URLs, then PUT each file straight to Supabase.
 * Falls back by throwing with code OBJECT_STORAGE_UNAVAILABLE (caller may use multipart).
 */
export async function uploadPagesDirectToStorage(params: {
  testId: string;
  classId: string;
  files: File[];
  signal?: AbortSignal;
}): Promise<DirectUploadResult> {
  const { testId, classId, files, signal } = params;
  if (files.length === 0) {
    throw new Error("At least one page is required.");
  }

  const signed = await handleJson<{ uploads: SignedUploadSlot[] }>(
    await fetch("/api/uploads/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        purpose: "stack_preview",
        testId,
        classId,
        files: files.map((file) => ({
          filename: file.name,
          contentType: file.type || "image/jpeg",
          size: file.size,
        })),
      }),
    }),
  );

  if (!signed.uploads || signed.uploads.length !== files.length) {
    throw new Error("Signed upload response did not match page count.");
  }

  const storagePaths: string[] = [];
  const imageMeta: { filename: string; mimeType: string }[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const slot = signed.uploads[index];
    const contentType = file.type || slot.contentType || "image/jpeg";

    const uploadRes = await fetch(slot.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: file,
      signal,
    });

    if (!uploadRes.ok) {
      const detail = (await uploadRes.text().catch(() => "")).slice(0, 120);
      throw new Error(
        detail
          ? `Direct upload failed (${uploadRes.status}): ${detail}`
          : `Direct upload failed (${uploadRes.status}).`,
      );
    }

    storagePaths.push(slot.path);
    imageMeta.push({
      filename: slot.filename || file.name || `page-${index + 1}`,
      mimeType: contentType,
    });
  }

  return { storagePaths, imageMeta };
}
