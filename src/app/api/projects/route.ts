import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toProjectSummary } from "@/lib/serializers";

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "请输入项目名称。").max(80, "项目名称过长。")
});

export async function GET(): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  try {
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, shareToken: true, updatedAt: true }
    });
    return NextResponse.json(projects.map(toProjectSummary));
  } catch {
    return NextResponse.json({ error: "暂时无法载入项目。" }, { status: 503 });
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
    return NextResponse.json({ error: "项目内容无效。" }, { status: 400 });
  }
  const parsed = createProjectSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "项目内容无效。" },
      { status: 400 }
    );
  }

  try {
    const project = await prisma.project.create({
      data: { name: parsed.data.name, userId },
      select: { id: true, name: true, shareToken: true, updatedAt: true }
    });
    return NextResponse.json(toProjectSummary(project), { status: 201 });
  } catch {
    return NextResponse.json({ error: "暂时无法创建项目。" }, { status: 503 });
  }
}
