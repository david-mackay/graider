import { readFile } from "@/lib/storage";
import { GradeStackPreviewJobInput } from "@/lib/types";

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
  gif: "image/gif",
};

function guessMimeType(storagePath: string, fallback?: string) {
  if (fallback) return fallback;
  const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "image/jpeg";
}

export async function loadPreviewImagesFromStorage(input: GradeStackPreviewJobInput) {
  const images: { filename: string; mimeType: string; base64: string }[] = [];

  for (let index = 0; index < input.storagePaths.length; index += 1) {
    const storagePath = input.storagePaths[index];
    const meta = input.imageMeta[index];
    const buffer = await readFile(storagePath);
    images.push({
      filename: meta?.filename ?? storagePath.split("/").pop() ?? `page-${index}`,
      mimeType: guessMimeType(storagePath, meta?.mimeType),
      base64: buffer.toString("base64"),
    });
  }

  return images;
}
