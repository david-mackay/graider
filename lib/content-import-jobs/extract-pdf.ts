import { PDFParse } from "pdf-parse";
import { readFile } from "@/lib/storage";
import { assessPdfText } from "@/lib/mcq";

export type PdfTextAssessment = {
  usable: boolean;
  text: string;
};

/** Extract text without throwing on empty/scan PDFs — caller decides the path. */
export async function extractPdfTextAssessmentFromBuffer(
  buffer: Buffer,
): Promise<PdfTextAssessment> {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return assessPdfText(parsed.text ?? "");
  } catch {
    return { usable: false, text: "" };
  } finally {
    await parser.destroy();
  }
}

export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<string> {
  const assessment = await extractPdfTextAssessmentFromBuffer(buffer);
  if (!assessment.usable || !assessment.text.trim()) {
    throw new Error("Could not extract text from this PDF. Try a text-based PDF (not a scan), or upload a photo of the key.");
  }
  return assessment.text;
}

export async function extractPdfText(storagePath: string): Promise<string> {
  const buffer = await readFile(storagePath);
  return extractPdfTextFromBuffer(buffer);
}

export async function extractPdfTextAssessment(storagePath: string): Promise<PdfTextAssessment> {
  const buffer = await readFile(storagePath);
  return extractPdfTextAssessmentFromBuffer(buffer);
}
