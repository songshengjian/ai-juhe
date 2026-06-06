import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AuthForm } from "@/components/auth/auth-form";
import { Brand } from "@/components/layout/brand";
import { authOptions } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/");
  }

  return (
    <div className="w-full max-w-[400px]">
      <Brand className="mb-12 lg:hidden" />
      <p className="text-sm font-medium text-muted-foreground">欢迎回来</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">登录镜刻</h1>
      <p className="mt-3 text-sm text-muted-foreground">继续你的对话、项目和资料库。</p>
      <AuthForm mode="login" />
    </div>
  );
}
