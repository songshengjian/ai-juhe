import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserId } from "@/lib/auth";
import { modelIdSchema } from "@/lib/model-gateway";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MODEL_ID, type ConversationSummary } from "@/types";

const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).default("新对话"),
  modelId: modelIdSchema.default(DEFAULT_MODEL_ID),
  projectId: z.string().min(1).nullable().optional()
});

function toSummary(record: {
  id: string;
  title: string;
  modelId: string;
  projectId: string | null;
  updatedAt: Date;
}): ConversationSummary {
  const modelId = modelIdSchema.safeParse(record.modelId);
  return {
    id: record.id,
    title: record.title,
    modelId: modelId.success ? modelId.data : DEFAULT_MODEL_ID,
    projectId: record.projectId,
    updatedAt: record.updatedAt.toISOString()
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";
  try {
    const records = await prisma.conversation.findMany({
      where: {
        userId,
        ...(search ? { title: { contains: search } } : {})
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, modelId: true, projectId: true, updatedAt: true }
    });

    return NextResponse.json(records.map(toSummary));
  } catch {
    return NextResponse.json({ error: "暂时无法载入对话列表。" }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }
  const parsed = createConversationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "无法创建对话。" }, { status: 400 });
  }

  try {
    if (parsed.data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: parsed.data.projectId, userId },
        select: { id: true }
      });
      if (!project) {
        return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
      }
    }
    const record = await prisma.conversation.create({
      data: {
        userId,
        title: parsed.data.title,
        modelId: parsed.data.modelId,
        projectId: parsed.data.projectId ?? null
      },
      select: { id: true, title: true, modelId: true, projectId: true, updatedAt: true }
    });

    return NextResponse.json(toSummary(record), { status: 201 });
  } catch {
    return NextResponse.json({ error: "暂时无法创建对话。" }, { status: 503 });
  }
}
