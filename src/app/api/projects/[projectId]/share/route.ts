import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { getAuthenticatedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }
  const { projectId } = await context.params;
  try {
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { shareToken: true }
    });
    if (!existing) {
      return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    }
    const token = existing.shareToken ?? randomBytes(24).toString("hex");
    if (!existing.shareToken) {
      await prisma.project.update({
        where: { id: projectId },
        data: { shareToken: token }
      });
    }
    const url = new URL(`/share/${token}`, request.url).toString();
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "暂时无法分享项目。" }, { status: 503 });
  }
}
