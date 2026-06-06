import { extname } from "node:path";
import { inflateRawSync } from "node:zlib";

const MAX_EXTRACTED_CHARACTERS = 120_000;
const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".log",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".sql",
  ".yaml",
  ".yml"
]);

export interface ParsedUploadContent {
  extractedText: string | null;
  parseError: string | null;
}

function tidyText(value: string): string | null {
  const text = value
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARACTERS);
  return text || null;
}

function decodeXml(value: string): string {
  return value
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let endOffset = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65_558); index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      endOffset = index;
      break;
    }
  }
  if (endOffset < 0) {
    return entries;
  }

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let cursor = buffer.readUInt32LE(endOffset + 16);
  for (let index = 0; index < entryCount && cursor + 46 <= buffer.length; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      break;
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString("utf8");

    if (localOffset + 30 <= buffer.length && buffer.readUInt32LE(localOffset) === 0x04034b50) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(start, start + compressedSize);
      if (method === 0) {
        entries.set(name, compressed);
      } else if (method === 8) {
        entries.set(name, inflateRawSync(compressed));
      }
    }
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function extractDocx(buffer: Buffer): string | null {
  const entries = readZipEntries(buffer);
  const content = ["word/document.xml", "word/header1.xml", "word/footer1.xml"]
    .map((entry) => entries.get(entry)?.toString("utf8") ?? "")
    .filter(Boolean)
    .map(decodeXml)
    .join("\n");
  return tidyText(content);
}

function extractXlsx(buffer: Buffer): string | null {
  const entries = readZipEntries(buffer);
  const sharedXml = entries.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const sharedStrings = Array.from(sharedXml.matchAll(/<si[\s\S]*?<\/si>/g)).map((match) =>
    decodeXml(match[0]).trim()
  );
  const sheets = Array.from(entries.entries())
    .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort(([left], [right]) => left.localeCompare(right));
  const rows = sheets.flatMap(([, bytes]) => {
    const xml = bytes.toString("utf8");
    return Array.from(xml.matchAll(/<row[\s\S]*?<\/row>/g)).map((rowMatch) => {
      const cells = Array.from(rowMatch[0].matchAll(/<c([^>]*)>[\s\S]*?<v>([\s\S]*?)<\/v>[\s\S]*?<\/c>/g)).map(
        (cellMatch) => {
          const type = cellMatch[1]?.includes('t="s"') ? "shared" : "value";
          const rawValue = cellMatch[2] ?? "";
          return type === "shared" ? sharedStrings[Number(rawValue)] ?? rawValue : rawValue;
        }
      );
      return cells.join("\t");
    });
  });
  return tidyText(rows.join("\n"));
}

function extractPdf(buffer: Buffer): string | null {
  const source = buffer.toString("latin1");
  const strings = Array.from(source.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g)).map((match) =>
    (match[1] ?? "").replace(/\\([()\\])/g, "$1")
  );
  return tidyText(strings.join("\n"));
}

export async function parseUploadContent(file: File): Promise<ParsedUploadContent> {
  const extension = extname(file.name).toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    let extractedText: string | null = null;
    if (TEXT_EXTENSIONS.has(extension) || file.type.startsWith("text/")) {
      extractedText = tidyText(bytes.toString("utf8"));
    } else if (extension === ".docx") {
      extractedText = extractDocx(bytes);
    } else if (extension === ".xlsx") {
      extractedText = extractXlsx(bytes);
    } else if (extension === ".pdf") {
      extractedText = extractPdf(bytes);
    } else if (file.type.startsWith("image/")) {
      return { extractedText: null, parseError: null };
    } else {
      return { extractedText: null, parseError: "当前文件类型暂不支持内容解析。" };
    }

    return extractedText
      ? { extractedText, parseError: null }
      : { extractedText: null, parseError: "文件中未提取到可读取的文字内容。" };
  } catch {
    return { extractedText: null, parseError: "文件解析失败，请尝试上传文本或 DOCX 文件。" };
  }
}
