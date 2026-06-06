"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AuthFormProps {
  mode: "login" | "register";
}

interface ErrorPayload {
  error?: string;
}

async function responseError(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as ErrorPayload).error === "string"
    ) {
      return (payload as ErrorPayload).error ?? "操作失败。";
    }
  } catch {
    return "操作失败，请稍后重试。";
  }
  return "操作失败，请稍后重试。";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      if (isRegister) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() || undefined, email, password })
        });
        if (!response.ok) {
          setError(await responseError(response));
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false
      });
      if (result?.error) {
        setError("邮箱或密码不正确。");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      {isRegister ? (
        <Input
          name="name"
          autoComplete="name"
          placeholder="姓名（可选）"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-12 rounded-xl"
        />
      ) : null}
      <Input
        required
        type="email"
        name="email"
        autoComplete="email"
        placeholder="电子邮箱"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="h-12 rounded-xl"
      />
      <Input
        required
        minLength={8}
        type="password"
        name="password"
        autoComplete={isRegister ? "new-password" : "current-password"}
        placeholder="密码"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="h-12 rounded-xl"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl">
        {pending ? "请稍候..." : isRegister ? "创建账户" : "继续"}
      </Button>
      <p className="pt-2 text-center text-sm text-muted-foreground">
        {isRegister ? "已有账户？" : "还没有账户？"}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="ml-1 text-primary transition-colors duration-150 ease-in-out hover:text-primary/80"
        >
          {isRegister ? "登录" : "注册"}
        </Link>
      </p>
    </form>
  );
}
