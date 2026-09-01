import path from "path";
// pdf-parse v2 needs the worker/canvas factory BEFORE the main import.
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { readFile, uploadFile } from "@/lib/storage";

function isPdfPath(storagePath: string): boolean {
  return path.extname(storagePath).toLowerCase() === ".pdf";
}

async function rasterizePdfToPageImages(storagePath: string): Promise<string[]> {
  const buffer = await readFile(storagePath);
  const parser = new PDFParse({ data: buffer, CanvasFactory });
  try {
    const shots = await parser.getScreenshot({
      desiredWidth: 1000,
      imageBuffer: true,
      imageDataUrl: false,
    });
    if (shots.pages.length === 0) return [storagePath];

    const stem = storagePath.replace(/\.pdf$/i, "");
    const paths: string[] = [];
    for (const page of shots.pages) {
      const outPath = `${stem}-p${page.pageNumber}.png`;
      await uploadFile(outPath, Buffer.from(page.data), "image/png");
      paths.push(outPath);
    }
    return paths;
  } finally {
    await parser.destroy();
  }
}

/** Turn PDF uploads into one PNG per page so the paper viewer can show every page. */
export async function expandPaperUploadPaths(storagePaths: string[]): Promise<string[]> {
  const expanded: string[] = [];
  for (const storagePath of storagePaths) {
    if (!isPdfPath(storagePath)) {
      expanded.push(storagePath);
      continue;
    }
    try {
      expanded.push(...(await rasterizePdfToPageImages(storagePath)));
    } catch {
      expanded.push(storagePath);
    }
  }
  return expanded;
}
