import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

const materialSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["image", "video", "audio", "file"]),
  previewUrl: z.string().nullable()
});
const patchSchema = z.object({
  progress: z.number().int().min(0).max(100).optional(),
  status: z.enum(["running", "submitted", "completed", "failed"]).optional(),
  model: z.string().min(1).max(120).optional(),
  resolution: z.enum(["2K", "4K"]).optional(),
  outputUrls: z.array(z.string()).optional(),
  outputCount: z.number().int().min(1).max(8).optional(),
  sourceMaterials: z.array(materialSchema).optional(),
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

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }
  const { jobId } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid generation job update." }, { status: 400 });
  }

  const exists = await prisma.generationJobRecord.findFirst({
    where: { id: jobId, userId },
    select: { id: true }
  });
  if (!exists) {
    return NextResponse.json({ error: "Generation job not found." }, { status: 404 });
  }

  const patch = parsed.data;
  await prisma.generationJobRecord.update({
    where: { id: jobId },
    data: {
      ...("progress" in patch ? { progress: patch.progress } : {}),
      ...("status" in patch ? { status: patch.status } : {}),
      ...("model" in patch ? { model: patch.model } : {}),
      ...("resolution" in patch ? { resolution: patch.resolution } : {}),
      ...("outputUrls" in patch ? { outputUrls: patch.outputUrls ?? [] } : {}),
      ...("outputCount" in patch ? { outputCount: patch.outputCount } : {}),
      ...("sourceMaterials" in patch
        ? {
            sourceMaterials: (patch.sourceMaterials ?? []).map((material) => ({
              ...material,
              previewUrl: sanitizePreviewUrl(material.previewUrl)
            }))
          }
        : {}),
      ...("resultText" in patch ? { resultText: patch.resultText ?? null } : {}),
      ...("taskId" in patch ? { taskId: patch.taskId ?? null } : {}),
      ...("error" in patch ? { error: patch.error ?? null } : {})
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }
  const { jobId } = await context.params;
  const result = await prisma.generationJobRecord.deleteMany({
    where: { id: jobId, userId }
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Generation job not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
