import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserId } from "@/lib/auth";
import { removeUpload } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { toProjectSummary } from "@/lib/serializers";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(80)
});

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }
  const { projectId } = await context.params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "项目内容无效。" }, { status: 400 });
  }
  const parsed = updateProjectSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "项目名称无效。" }, { status: 400 });
  }

  try {
    const exists = await prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!exists) {
      return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    }
    const project = await prisma.project.update({
      where: { id: projectId },
      data: { name: parsed.data.name },
      select: { id: true, name: true, shareToken: true, updatedAt: true }
    });
    return NextResponse.json(toProjectSummary(project));
  } catch {
    return NextResponse.json({ error: "暂时无法重命名项目。" }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }
  const { projectId } = await context.params;
  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { assets: { select: { storedName: true } } }
    });
    if (!project) {
      return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    }
    await prisma.$transaction([
      prisma.conversation.deleteMany({ where: { projectId, userId } }),
      prisma.asset.deleteMany({ where: { projectId, userId } }),
      prisma.project.delete({ where: { id: projectId } })
    ]);
    await Promise.all(project.assets.map((asset) => removeUpload(asset.storedName)));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "暂时无法删除项目。" }, { status: 503 });
  }
}
