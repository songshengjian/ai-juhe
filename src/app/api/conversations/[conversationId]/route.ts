import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserId } from "@/lib/auth";
import { modelIdSchema } from "@/lib/model-gateway";
import { prisma } from "@/lib/prisma";
import { deleteCachedConversation } from "@/lib/redis";
import { DEFAULT_MODEL_ID, type ConversationDetail } from "@/types";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    modelId: modelIdSchema.optional()
  })
  .refine((data) => data.title !== undefined || data.modelId !== undefined);

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }
  const { conversationId } = await context.params;
  let record;
  try {
    record = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { attachments: { include: { asset: true } } }
        }
      }
    });
  } catch {
    return NextResponse.json({ error: "暂时无法载入对话。" }, { status: 503 });
  }
  if (!record) {
    return NextResponse.json({ error: "对话不存在。" }, { status: 404 });
  }

  const parsedModel = modelIdSchema.safeParse(record.modelId);
  const detail: ConversationDetail = {
    id: record.id,
    title: record.title,
    modelId: parsedModel.success ? parsedModel.data : DEFAULT_MODEL_ID,
    projectId: record.projectId,
    updatedAt: record.updatedAt.toISOString(),
    messages: record.messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      totalTokens: message.totalTokens,
      attachments: message.attachments.map(({ asset }) => ({
        id: asset.id,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        projectId: asset.projectId,
        createdAt: asset.createdAt.toISOString(),
        contentUrl: `/api/files/${asset.id}/content`,
        textExtracted: Boolean(asset.extractedText),
        parseError: asset.parseError
      }))
    }))
  };
  return NextResponse.json(detail);
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "更新内容无效。" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "更新内容无效。" }, { status: 400 });
  }
  const { conversationId } = await context.params;
  let result;
  try {
    result = await prisma.conversation.updateMany({
      where: { id: conversationId, userId },
      data: parsed.data
    });
  } catch {
    return NextResponse.json({ error: "暂时无法更新对话。" }, { status: 503 });
  }
  if (result.count === 0) {
    return NextResponse.json({ error: "对话不存在。" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }
  const { conversationId } = await context.params;
  let result;
  try {
    result = await prisma.conversation.deleteMany({
      where: { id: conversationId, userId }
    });
  } catch {
    return NextResponse.json({ error: "暂时无法删除对话。" }, { status: 503 });
  }
  if (result.count === 0) {
    return NextResponse.json({ error: "对话不存在。" }, { status: 404 });
  }
  await deleteCachedConversation(conversationId);
  return NextResponse.json({ ok: true });
}
