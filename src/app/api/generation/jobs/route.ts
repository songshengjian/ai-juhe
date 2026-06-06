import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const creationTypeSchema = z.enum(["agent", "image", "video", "avatar", "voice", "motion"]);
const materialSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["image", "video", "audio", "file"]),
  previewUrl: z.string().nullable()
});
const jobSchema = z.object({
  id: z.string().min(1).max(64),
  type: creationTypeSchema,
  prompt: z.string().min(1).max(12000),
  ratio: z.string().min(1).max(16),
  progress: z.number().int().min(0).max(100),
  model: z.string().min(1).max(120),
  duration: z.string().min(1).max(16),
  resolution: z.enum(["2K", "4K"]).default("2K"),
  outputCount: z.number().int().min(1).max(8),
  sourceMaterials: z.array(materialSchema).default([]),
  cost: z.number().int().min(0),
  status: z.enum(["running", "submitted", "completed", "failed"]).default("running"),
  outputUrls: z.array(z.string()).optional(),
  resultText: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  error: z.string().nullable().optional()
});

function sanitizePreviewUrl(previewUrl: string | null): string | null {
  if (!previewUrl || previewUrl.startsWith("blob:")) {
    return null;
  }
  return previewUrl;
}

function jobTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  }).format(date);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function serializeJob(record: {
  id: string;
  type: string;
  prompt: string;
  ratio: string;
  progress: number;
  model: string;
  duration: string;
  resolution: string;
  outputCount: number;
  sourceMaterials: unknown;
  cost: number;
  status: string;
  outputUrls: unknown;
  resultText: string | null;
  taskId: string | null;
  error: string | null;
  createdAt: Date;
}) {
  return {
    id: record.id,
    type: record.type,
    prompt: record.prompt,
    ratio: record.ratio,
    progress: record.progress,
    model: record.model,
    duration: record.duration,
    resolution: record.resolution,
    createdAt: jobTimeLabel(record.createdAt),
    outputCount: record.outputCount,
    sourceMaterials: asArray(record.sourceMaterials),
    cost: record.cost,
    status: record.status,
    outputUrls: asArray(record.outputUrls).filter((item): item is string => typeof item === "string"),
    resultText: record.resultText ?? undefined,
    taskId: record.taskId ?? undefined,
    error: record.error ?? undefined
  };
}

export async function GET(): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  const records = await prisma.generationJobRecord.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 80
  });

  return NextResponse.json(records.map(serializeJob));
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  const parsed = jobSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid generation job." }, { status: 400 });
  }

  const job = parsed.data;
  const record = await prisma.generationJobRecord.upsert({
    where: { id: job.id },
    update: {
      type: job.type,
      prompt: job.prompt,
      ratio: job.ratio,
      progress: job.progress,
      model: job.model,
      duration: job.duration,
      resolution: job.resolution,
      outputCount: job.outputCount,
      sourceMaterials: job.sourceMaterials.map((material) => ({
        ...material,
        previewUrl: sanitizePreviewUrl(material.previewUrl)
      })),
      cost: job.cost,
      status: job.status,
      outputUrls: job.outputUrls ?? [],
      resultText: job.resultText ?? null,
      taskId: job.taskId ?? null,
      error: job.error ?? null
    },
    create: {
      id: job.id,
      userId,
      type: job.type,
      prompt: job.prompt,
      ratio: job.ratio,
      progress: job.progress,
      model: job.model,
      duration: job.duration,
      resolution: job.resolution,
      outputCount: job.outputCount,
      sourceMaterials: job.sourceMaterials.map((material) => ({
        ...material,
        previewUrl: sanitizePreviewUrl(material.previewUrl)
      })),
      cost: job.cost,
      status: job.status,
      outputUrls: job.outputUrls ?? [],
      resultText: job.resultText ?? null,
      taskId: job.taskId ?? null,
      error: job.error ?? null
    }
  });

  return NextResponse.json(serializeJob(record), { status: 201 });
}
