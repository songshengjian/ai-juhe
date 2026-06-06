import { Bot, MessageSquareText, Sparkles } from "lucide-react";

import { Brand } from "@/components/layout/brand";

export function AuthArtwork() {
  return (
    <section className="relative hidden min-h-screen overflow-hidden bg-[#171717] lg:flex lg:flex-col lg:justify-between">
      <div className="absolute left-[-120px] top-[-100px] h-[420px] w-[420px] animate-auth-orb-one rounded-full bg-primary/30 blur-3xl" />
      <div className="absolute bottom-[-120px] right-[-40px] h-[460px] w-[460px] animate-auth-orb-two rounded-full bg-primary/25 blur-3xl" />
      <div className="absolute left-[30%] top-[36%] h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <Brand inverse className="relative z-10 px-10 pt-9 text-xl text-white" />
      <div className="relative z-10 mx-auto flex w-full max-w-[640px] items-center justify-center px-10">
        <div className="relative h-[430px] w-full">
          <div className="absolute left-8 top-16 w-64 animate-auth-float rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 text-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                <Bot className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">智能协作助手</span>
            </div>
            <div className="mt-5 h-2 w-full rounded-full bg-white/10">
              <div className="h-2 w-4/5 rounded-full bg-primary" />
            </div>
            <div className="mt-3 h-2 w-3/5 rounded-full bg-white/10" />
          </div>
          <div className="absolute bottom-16 right-8 w-72 animate-auth-drift overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.08] p-5 shadow-2xl backdrop-blur-xl">
            <div className="absolute inset-y-0 left-0 w-20 animate-auth-scan bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="mb-5 flex items-center gap-2 text-xs text-white/60">
              <MessageSquareText className="h-4 w-4" />
              实时对话
            </div>
            <div className="ml-auto w-4/5 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white">
              帮我整理今天的项目思路
            </div>
            <div className="mt-3 w-5/6 rounded-2xl bg-primary/25 px-4 py-3 text-sm leading-6 text-white/90">
              已为你生成结构化清单，并关联相关资料。
            </div>
          </div>
          <div className="absolute left-[44%] top-[42%] flex h-28 w-28 animate-auth-float items-center justify-center rounded-full border border-primary/25 bg-primary/10 shadow-[0_0_80px_rgba(16,163,127,0.25)]">
            <Sparkles className="h-9 w-9 text-primary" />
          </div>
        </div>
      </div>
      <div className="relative z-10 px-10 pb-10">
        <h2 className="max-w-lg text-4xl font-medium leading-tight text-white">
          对话、资料与灵感，
          <br />
          汇聚在同一个工作空间。
        </h2>
        <p className="mt-4 text-sm text-white/55">使用多模型能力，为每一次创作找到更快的路径。</p>
      </div>
    </section>
  );
}
