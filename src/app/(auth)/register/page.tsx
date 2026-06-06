import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AuthForm } from "@/components/auth/auth-form";
import { Brand } from "@/components/layout/brand";
import { authOptions } from "@/lib/auth";

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/");
  }

  return (
    <div className="w-full max-w-[400px]">
      <Brand className="mb-12 lg:hidden" />
      <p className="text-sm font-medium text-muted-foreground">开始使用</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">创建账户</h1>
      <p className="mt-3 text-sm text-muted-foreground">注册后即可保存你的对话与项目内容。</p>
      <AuthForm mode="register" />
    </div>
  );
}
