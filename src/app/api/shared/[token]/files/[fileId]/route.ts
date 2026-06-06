import { NextResponse } from "next/server";

import { readUpload } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ token: string; fileId: string }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { token, fileId } = await context.params;
  const asset = await prisma.asset.findFirst({
    where: {
      id: fileId,
      project: { shareToken: token }
    }
  });
  if (!asset) {
    return NextResponse.json({ error: "文件不存在。" }, { status: 404 });
  }
  try {
    const content = await readUpload(asset.storedName);
    return new Response(new Uint8Array(content), {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch {
    return NextResponse.json({ error: "文件内容不可用。" }, { status: 404 });
  }
}
