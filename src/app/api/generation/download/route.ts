import { NextResponse } from "next/server";

import { getAuthenticatedUserId } from "@/lib/auth";

export const runtime = "nodejs";

function safeFileName(value: string | null): string {
  const fallback = "ai-juhe-output";
  const decoded = value ? decodeURIComponent(value) : fallback;
  return (decoded || fallback).replace(/[\\/:*?"<>|\r\n]+/g, "-").slice(0, 120);
}

export async function GET(request: Request): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing download URL." }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid download URL." }, { status: 400 });
  }

  if (!["http:", "https:", "data:"].includes(targetUrl.protocol)) {
    return NextResponse.json({ error: "Unsupported download URL." }, { status: 400 });
  }

  if (targetUrl.protocol === "data:") {
    const [metadata = "", data = ""] = target.split(",");
    const mimeType = metadata.match(/^data:([^;,]+)/)?.[1] ?? "application/octet-stream";
    const buffer = Buffer.from(data, metadata.includes(";base64") ? "base64" : "utf8");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${safeFileName(url.searchParams.get("filename"))}"`
      }
    });
  }

  const upstream = await fetch(targetUrl, {
    headers: {
      "User-Agent": "ai-juhe-download/1.0"
    }
  });
  if (!upstream.ok) {
    return NextResponse.json({ error: "Unable to download generated output." }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${safeFileName(url.searchParams.get("filename"))}"`,
      "Cache-Control": "private, max-age=60"
    }
  });
}
