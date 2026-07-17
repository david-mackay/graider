import { PDFParse } from "pdf-parse";
import { readFile } from "@/lib/storage";

export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    const text = parsed.text?.trim() ?? "";
    if (!text) {
      throw new Error("Could not extract text from this PDF. Try a text-based PDF (not a scan).");
    }
    return text.slice(0, 120_000);
  } finally {
    await parser.destroy();
  }
}

export async function extractPdfText(storagePath: string): Promise<string> {
  const buffer = await readFile(storagePath);
  return extractPdfTextFromBuffer(buffer);
}
