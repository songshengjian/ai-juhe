import { NextResponse } from "next/server";

import { getAuthenticatedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteCachedConversation } from "@/lib/redis";

interface RouteContext {
  params: Promise<{ conversationId: string; messageId: string }>;
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }
  const { conversationId, messageId } = await context.params;
  let conversation;
  try {
    conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true }
    });
  } catch {
    return NextResponse.json({ error: "暂时无法访问对话。" }, { status: 503 });
  }
  if (!conversation) {
    return NextResponse.json({ error: "对话不存在。" }, { status: 404 });
  }

  let result;
  try {
    result = await prisma.message.deleteMany({
      where: { id: messageId, conversationId }
    });
  } catch {
    return NextResponse.json({ error: "暂时无法删除消息。" }, { status: 503 });
  }
  if (result.count === 0) {
    return NextResponse.json({ error: "消息不存在。" }, { status: 404 });
  }
  await deleteCachedConversation(conversationId);
  return NextResponse.json({ ok: true });
}
