import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

export async function uploadFile(
  filePath: string,
  buffer: Buffer,
  _contentType?: string,
): Promise<void> {
  const fullPath = path.join(UPLOAD_DIR, filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
}

export async function getFilePath(filePath: string): Promise<string> {
  return path.join(UPLOAD_DIR, filePath);
}
