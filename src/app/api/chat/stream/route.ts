import { RequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserId } from "@/lib/auth";
import {
  getConversationContext,
  modelIdSchema,
  openProviderStream,
  ProviderConfigurationError
} from "@/lib/model-gateway";
import { prisma } from "@/lib/prisma";
import { enforceChatRateLimit, RateLimitError } from "@/lib/rate-limit";
import { deleteCachedConversation } from "@/lib/redis";
import type { ChatStreamEvent } from "@/types";

const requestSchema = z.object({
  conversationId: z.string().min(1),
  modelId: modelIdSchema,
  content: z.string().trim().max(30000).default(""),
  attachmentIds: z.array(z.string().min(1)).max(10).default([]),
  persistUserMessage: z.boolean().default(true)
}).refine((data) => data.content.length > 0 || data.attachmentIds.length > 0, {
  message: "消息或附件不能为空。"
});

const upstreamEventSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z.object({ content: z.string().optional() }).optional()
      })
    )
    .optional(),
  usage: z
    .object({
      prompt_tokens: z.number().int().optional(),
      completion_tokens: z.number().int().optional(),
      total_tokens: z.number().int().optional()
    })
    .nullable()
    .optional()
});

interface Usage {
  inputTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

function upstreamFailureMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "模型认证失败，请联系管理员更新配置。";
  }
  if (status === 402 || status === 429) {
    return "模型额度不足或请求过于频繁，请稍后再试。";
  }
  return "模型服务暂时不可用，请稍后重试。";
}

function encodeEvent(encoder: TextEncoder, event: ChatStreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "消息内容无效。" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "消息内容无效。" }, { status: 400 });
  }

  let conversation;
  try {
    conversation = await prisma.conversation.findFirst({
      where: { id: parsed.data.conversationId, userId },
      select: { id: true, projectId: true }
    });
  } catch {
    return NextResponse.json({ error: "聊天服务暂时不可用，请稍后再试。" }, { status: 503 });
  }
  if (!conversation) {
    return NextResponse.json({ error: "对话不存在。" }, { status: 404 });
  }

  try {
    await enforceChatRateLimit(userId);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    return NextResponse.json({ error: "无法处理请求，请稍后重试。" }, { status: 500 });
  }

  let log;
  try {
    const attachments =
      parsed.data.attachmentIds.length > 0
        ? await prisma.asset.findMany({
            where: { id: { in: parsed.data.attachmentIds }, userId },
            select: { id: true }
          })
        : [];
    if (attachments.length !== parsed.data.attachmentIds.length) {
      return NextResponse.json({ error: "包含无法访问的附件。" }, { status: 400 });
    }
    if (parsed.data.persistUserMessage) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "USER",
          content: parsed.data.content,
          attachments: {
            create: attachments.map((asset) => ({ assetId: asset.id }))
          }
        }
      });
      await deleteCachedConversation(conversation.id);
    }
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { modelId: parsed.data.modelId }
    });
    if (conversation.projectId) {
      await prisma.project.update({
        where: { id: conversation.projectId },
        data: { updatedAt: new Date() }
      });
    }

    log = await prisma.apiRequestLog.create({
      data: {
        userId,
        conversationId: conversation.id,
        modelId: parsed.data.modelId
      }
    });
  } catch {
    return NextResponse.json({ error: "暂时无法保存消息，请稍后重试。" }, { status: 503 });
  }

  let upstream: Response;
  try {
    const context = await getConversationContext(conversation.id);
    upstream = await openProviderStream(parsed.data.modelId, context, request.signal);
  } catch (error) {
    await prisma.apiRequestLog
      .update({
        where: { id: log.id },
        data: {
          status: RequestStatus.FAILED,
          errorCode: error instanceof ProviderConfigurationError ? "NOT_CONFIGURED" : "NETWORK_ERROR",
          completedAt: new Date()
        }
      })
      .catch(() => undefined);
    const message =
      error instanceof ProviderConfigurationError
        ? error.message
        : "无法连接模型服务，请稍后再试。";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    await prisma.apiRequestLog
      .update({
        where: { id: log.id },
        data: {
          status: RequestStatus.FAILED,
          errorCode: `UPSTREAM_${upstream.status}`,
          completedAt: new Date()
        }
      })
      .catch(() => undefined);
    return NextResponse.json({ error: upstreamFailureMessage(upstream.status) }, { status: 502 });
  }

  const upstreamBody = upstream.body;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstreamBody.getReader();
      let buffer = "";
      let assistantContent = "";
      let usage: Usage = {
        inputTokens: null,
        completionTokens: null,
        totalTokens: null
      };
      let sentAnsweringStatus = false;

      try {
        controller.enqueue(encodeEvent(encoder, { type: "status", status: "thinking" }));
        while (true) {
          const result = await reader.read();
          if (result.done) {
            break;
          }
          buffer += decoder.decode(result.value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const content = line.trim();
            if (content === "event: error") {
              throw new Error("UPSTREAM_STREAM_ERROR");
            }
            if (!content.startsWith("data:")) {
              continue;
            }
            const data = content.slice(5).trim();
            if (!data || data === "[DONE]") {
              continue;
            }
            let json: unknown;
            try {
              json = JSON.parse(data);
            } catch {
              continue;
            }
            const event = upstreamEventSchema.safeParse(json);
            if (!event.success) {
              continue;
            }
            const delta = event.data.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              if (!sentAnsweringStatus) {
                sentAnsweringStatus = true;
                controller.enqueue(encodeEvent(encoder, { type: "status", status: "answering" }));
              }
              assistantContent += delta;
              controller.enqueue(encodeEvent(encoder, { type: "delta", delta }));
            }
            const responseUsage = event.data.usage;
            if (responseUsage) {
              usage = {
                inputTokens: responseUsage.prompt_tokens ?? null,
                completionTokens: responseUsage.completion_tokens ?? null,
                totalTokens: responseUsage.total_tokens ?? null
              };
            }
          }
        }

        if (!assistantContent) {
          throw new Error("EMPTY_RESPONSE");
        }

        const message = assistantContent
          ? await prisma.message.create({
              data: {
                conversationId: conversation.id,
                role: "ASSISTANT",
                content: assistantContent,
                ...usage
              },
              select: { id: true }
            })
          : null;
        await prisma.apiRequestLog.update({
          where: { id: log.id },
          data: {
            status: RequestStatus.COMPLETED,
            ...usage,
            completedAt: new Date()
          }
        });
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() }
        });
        await deleteCachedConversation(conversation.id);
        controller.enqueue(
          encodeEvent(encoder, {
            type: "done",
            messageId: message?.id ?? null,
            totalTokens: usage.totalTokens
          })
        );
        controller.close();
      } catch (error) {
        const cancelled = request.signal.aborted;
        await prisma.apiRequestLog
          .update({
            where: { id: log.id },
            data: {
              status: cancelled ? RequestStatus.CANCELLED : RequestStatus.FAILED,
              errorCode: cancelled ? "CANCELLED" : "STREAM_ERROR",
              completedAt: new Date()
            }
          })
          .catch(() => undefined);
        if (!cancelled) {
          const message =
            error instanceof Error && error.message === "UPSTREAM_STREAM_ERROR"
              ? "模型流式响应返回错误，请切换模型或稍后重试。"
              : error instanceof Error && error.message === "EMPTY_RESPONSE"
                ? "模型没有返回可显示内容，请切换模型或重新生成。"
                : "回复中断，请重新生成。";
          controller.enqueue(encodeEvent(encoder, { type: "error", error: message }));
        }
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
