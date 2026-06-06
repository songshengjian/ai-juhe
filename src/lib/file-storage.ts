import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
const storageDirectory = process.env.UPLOAD_DIR ?? join(process.cwd(), ".data", "uploads");

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export interface StoredUpload {
  fileName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
}

function safeExtension(fileName: string): string {
  const extension = extname(fileName).toLowerCase();
  return /^[.][a-z0-9]{1,10}$/.test(extension) ? extension : "";
}

export async function saveUpload(file: File): Promise<StoredUpload> {
  if (file.size === 0) {
    throw new UploadError("请选择非空文件。");
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new UploadError("单个文件不能超过 20 MB。");
  }

  const fileName = file.name.replace(/[\\/]/g, "_").slice(0, 255) || "untitled";
  const storedName = `${randomUUID()}${safeExtension(fileName)}`;
  await mkdir(storageDirectory, { recursive: true });
  await writeFile(join(storageDirectory, storedName), Buffer.from(await file.arrayBuffer()));
  return {
    fileName,
    storedName,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size
  };
}

export function readUpload(storedName: string): Promise<Buffer> {
  return readFile(join(storageDirectory, storedName));
}

export async function removeUpload(storedName: string): Promise<void> {
  await unlink(join(storageDirectory, storedName)).catch(() => undefined);
}
