import { NextResponse } from "next/server";

import { getAuthenticatedUserId } from "@/lib/auth";
import { parseUploadContent } from "@/lib/file-parser";
import { removeUpload, saveUpload, UploadError, type StoredUpload } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { deleteCachedConversation } from "@/lib/redis";
import { toAssetSummary } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }
  const projectId = new URL(request.url).searchParams.get("projectId") || undefined;
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) {
      return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    }
  }

  try {
    const assets = await prisma.asset.findMany({
      where: { userId, ...(projectId ? { projectId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 12
    });
    return NextResponse.json(assets.map(toAssetSummary));
  } catch {
    return NextResponse.json({ error: "暂时无法载入文件。" }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "上传内容无效。" }, { status: 400 });
  }
  const file = formData.get("file");
  const projectIdValue = formData.get("projectId");
  const projectId =
    typeof projectIdValue === "string" && projectIdValue.length > 0 ? projectIdValue : null;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请选择需要上传的文件。" }, { status: 400 });
  }
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) {
      return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    }
  }

  let stored: StoredUpload | null = null;
  try {
    stored = await saveUpload(file);
    const parsedContent = await parseUploadContent(file);
    const asset = await prisma.asset.create({
      data: { ...stored, ...parsedContent, userId, projectId }
    });
    if (projectId) {
      await prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
      const conversations = await prisma.conversation.findMany({
        where: { projectId, userId },
        select: { id: true }
      });
      await Promise.all(conversations.map((conversation) => deleteCachedConversation(conversation.id)));
    }
    return NextResponse.json(toAssetSummary(asset), { status: 201 });
  } catch (error) {
    if (stored) {
      await removeUpload(stored.storedName);
    }
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "暂时无法上传文件。" }, { status: 503 });
  }
}
