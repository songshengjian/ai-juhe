import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const registrationSchema = z.object({
  email: z.string().email("请输入有效邮箱").transform((email) => email.toLowerCase()),
  password: z.string().min(8, "密码至少需要 8 位").max(128, "密码过长"),
  name: z.string().trim().min(1).max(40).optional()
});

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "请求内容无效。" }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "注册信息无效。" },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "该邮箱已经注册。" }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash
      },
      select: { id: true, email: true, name: true }
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "该邮箱已经注册。" }, { status: 409 });
    }
    return NextResponse.json({ error: "注册服务暂时不可用，请稍后再试。" }, { status: 503 });
  }
}
