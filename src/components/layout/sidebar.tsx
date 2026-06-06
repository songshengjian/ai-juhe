"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import {
  AppWindow,
  AudioLines,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  FolderPlus,
  House,
  LogOut,
  MoreHorizontal,
  Search,
  Settings,
  Sparkles,
  SquarePen,
  Workflow
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BrandMark } from "@/components/layout/brand";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { formatCredits, type CreditPools } from "@/lib/generation-billing";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat-store";
import type { WorkspaceView } from "@/types";

interface SidebarProps {
  userName: string;
  userEmail: string;
  activeView: WorkspaceView;
  onOpenNewProject: () => void;
  onOpenSearch: () => void;
  onSelectView: (view: WorkspaceView) => void;
}

const plans = [
  {
    name: "免费用户",
    price: "¥0",
    yearly: "每日登录赠送",
    credits: "60 / 日",
    bonus: "当日清零",
    accent: "from-zinc-700/50 to-zinc-950",
    features: ["每日 60 免费积分", "当日 24 点清零", "可体验文生图和基础视频", "充值积分长期保留"]
  },
  {
    name: "基础会员",
    price: "¥69",
    yearly: "年费 659 元",
    credits: "758 / 月",
    bonus: "闲时视频 5 折",
    accent: "from-blue-600/50 to-slate-950",
    features: ["去水印", "延长视频时长", "0:00-8:00 视频生成 5 折", "月赠订阅积分"]
  },
  {
    name: "标准会员",
    price: "¥199",
    yearly: "年费 1899 元",
    credits: "2,210 / 月",
    bonus: "单次 5 个视频",
    current: true,
    accent: "from-blue-600/55 to-indigo-950",
    features: ["基础权益全部包含", "加速渲染", "更高清画质", "单次生成 5 个视频"]
  },
  {
    name: "高级会员",
    price: "¥499",
    yearly: "年费 5199 元",
    credits: "5,870 / 月",
    bonus: "最划算",
    accent: "from-amber-500/55 to-zinc-950",
    features: ["标准权益全部包含", "Seedance 视频生成免排队", "数字人大师模式", "专属客服"]
  }
];

const creditRules = [
  ["积分消耗顺序", "免费积分 → 订阅积分 → 充值积分，优先扣即将过期的积分。"],
  ["视频生成", "Seedance 按秒计费：高清 2K 为 8 积分 / 秒，超清 4K 为 12 积分 / 秒。"],
  ["数字人/动作", "数字人口型同步在视频基础上 +50 积分 / 15 秒；动作模仿 200 积分 / 次。"],
  ["图片生成", "文生图 1–8 积分 / 次；图生图 2–6 积分 / 次，具体按清晰度和参考素材计算。"],
  ["积分有效期", "免费积分当日 24 点清零；订阅积分 1 个月有效；充值积分永久有效。"],
  ["会员到期", "会员到期后订阅积分立即失效，免费积分和充值积分保留。"]
];

const topNavItems: Array<{
  label: string;
  view?: WorkspaceView;
  icon: typeof House;
  action?: "new-chat" | "search" | "new-project";
}> = [
  { label: "首页", view: "home", icon: House },
  { label: "新聊天", view: "chat", icon: SquarePen, action: "new-chat" },
  { label: "搜索", icon: Search, action: "search" },
  { label: "资料", view: "library", icon: BookOpen },
  { label: "应用", view: "apps", icon: AppWindow },
  { label: "音频", view: "audio", icon: AudioLines },
  { label: "生成", view: "generate", icon: Sparkles },
  { label: "画布", view: "canvas", icon: Workflow },
  { label: "项目", icon: FolderPlus, action: "new-project" }
];

function SidebarNavButton({
  label,
  active,
  icon: Icon,
  onClick
}: {
  label: string;
  active?: boolean;
  icon: typeof House;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "group flex h-[62px] w-[62px] flex-col items-center justify-center gap-1 rounded-2xl border border-transparent text-[12px] text-white/62 transition duration-200 hover:bg-white/[.07] hover:text-white",
        active &&
          "border-white/[.08] bg-white/[.09] text-white shadow-[0_12px_34px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.14)]"
      )}
    >
      <Icon className={cn("h-5 w-5 transition", active && "fill-white/90")} />
      <span className="leading-none">{label}</span>
    </button>
  );
}

function MembershipDialog({
  open,
  onOpenChange,
  credits,
  creditPools
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credits: number;
  creditPools: CreditPools;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto border-white/10 bg-[#070708] p-0 text-white shadow-2xl">
        <div className="p-5 md:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
            <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(45,84,255,.46),transparent_46%),linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.02))] p-5">
              <DialogTitle className="text-xl font-semibold">会员计划</DialogTitle>
              <DialogDescription className="mt-10 text-sm text-white/65">
                2026 年 5 月计费方案
              </DialogDescription>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-lg font-semibold">标准会员</span>
                <span className="rounded-md bg-amber-300 px-2 py-1 text-xs font-medium text-zinc-950">
                  生效中
                </span>
              </div>
              <p className="mt-5 text-xs text-white/55">月赠 2,210 订阅积分，订阅积分获取日起 1 个月有效。</p>
            </section>
            <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_12%_100%,rgba(0,110,255,.7),transparent_42%),linear-gradient(135deg,rgba(255,255,255,.06),rgba(255,255,255,.01))] p-5">
              <h3 className="text-xl font-semibold">积分值</h3>
              <div className="mt-9 grid grid-cols-4 gap-3 text-sm">
                {[
                  ["总共", formatCredits(credits)],
                  ["免费积分", formatCredits(creditPools.free)],
                  ["订阅积分", formatCredits(creditPools.subscription)],
                  ["充值积分", formatCredits(creditPools.recharge)]
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-white/52">{label}</div>
                    <div className="mt-2 text-lg font-semibold">{value}</div>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_10%_100%,rgba(33,73,255,.48),transparent_46%),linear-gradient(135deg,rgba(255,255,255,.06),rgba(255,255,255,.01))] p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">权益说明</h3>
                <button type="button" className="text-sm text-emerald-300">查看更多</button>
              </div>
              <div className="mt-11 space-y-2 text-sm text-white/72">
                <p>• 免费积分每日登录赠送，当日 24 点清零。</p>
                <p>• 订阅积分按会员档位月赠，会员到期后立即失效。</p>
                <p>• 充值积分长期有效，可跨月、跨年使用。</p>
              </div>
            </section>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={cn(
                  "relative rounded-2xl border border-white/10 bg-[#121212] p-4 shadow-xl shadow-black/20",
                  plan.current && "border-blue-400/70"
                )}
              >
                {plan.current ? (
                  <span className="absolute left-0 top-0 rounded-br-lg rounded-tl-2xl bg-blue-500 px-2 py-1 text-xs">
                    当前套餐
                  </span>
                ) : null}
                <div className={cn("rounded-xl bg-gradient-to-br p-4", plan.accent)}>
                  <h3 className="text-center text-lg font-semibold">{plan.name}</h3>
                  <div className="mt-6 text-center">
                    <span className="text-sm text-white/70">￥</span>
                    <span className="text-3xl font-bold">{plan.price.replace("¥", "")}</span>
                    <span className="ml-1 text-sm text-white/65">/月</span>
                  </div>
                  <div className="mt-1 text-center text-xs text-white/55">{plan.yearly}</div>
                </div>
                <button
                  type="button"
                  className={cn(
                    "mt-4 h-10 w-full rounded-lg bg-white/10 text-sm transition hover:bg-white/15",
                    plan.current && "bg-blue-500/20 text-blue-100"
                  )}
                >
                  {plan.current ? "当前套餐" : "去升级"}
                </button>
                <div className="mt-3 rounded-xl bg-white/[.06] p-3 text-center text-sm text-white/75">
                  <span className="font-semibold text-white">{plan.credits}</span> 积分
                  <div className="mt-1 text-xs text-blue-200">{plan.bonus}</div>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-white/70">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <section className="mt-6 rounded-2xl border border-white/10 bg-white/[.045] p-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">积分扣除规则</h3>
              <span className="text-xs text-white/45">已按免费 → 订阅 → 充值顺序真实扣除</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {creditRules.map(([title, rule]) => (
                <div key={title} className="rounded-xl bg-black/24 p-4">
                  <div className="font-medium text-white">{title}</div>
                  <p className="mt-2 text-sm leading-6 text-white/62">{rule}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProfileMenu({
  userName,
  userEmail,
  initials
}: {
  userName: string;
  userEmail: string;
  initials: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10"
          aria-label="打开账户菜单"
        >
          <Avatar className="h-8 w-8 ring-2 ring-white/15">
            <AvatarFallback className="bg-gradient-to-br from-amber-300 to-violet-500 text-[11px] text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="right"
        sideOffset={12}
        className="w-[280px] overflow-hidden rounded-lg border-white/10 bg-[#2b2b2b] p-0 text-white shadow-2xl"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-gradient-to-br from-amber-300 to-violet-500 text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{userName}</div>
            <div className="truncate text-xs text-white/52">{userEmail}</div>
          </div>
        </div>
        {["团队管理", "更多设置", "水印设置"].map((item) => (
          <DropdownMenuItem
            key={item}
            className="h-14 rounded-none border-t border-white/10 px-6 text-base focus:bg-white/10 focus:text-white"
          >
            <span>{item}</span>
            <ChevronRight className="ml-auto h-4 w-4 text-white/55" />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="m-0 bg-white/10" />
        <DropdownMenuItem
          className="h-14 rounded-none px-6 text-base focus:bg-white/10 focus:text-white"
          onSelect={() => void signOut({ callbackUrl: "/login" })}
        >
          <span>退出登录</span>
          <LogOut className="ml-auto h-5 w-5 text-white/55" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoreMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="更多"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="right"
        sideOffset={12}
        className="w-44 border-white/10 bg-[#262626] text-white"
      >
        <DropdownMenuItem className="focus:bg-white/10 focus:text-white">
          <Settings className="h-4 w-4" />
          快捷设置
        </DropdownMenuItem>
        <DropdownMenuItem
          className="focus:bg-white/10 focus:text-white"
          onSelect={() => void signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarBody({
  userName,
  userEmail,
  activeView,
  onOpenNewProject,
  onOpenSearch,
  onSelectView
}: SidebarProps) {
  const [plansOpen, setPlansOpen] = useState(false);
  const startNewConversation = useChatStore((state) => state.startNewConversation);
  const credits = useChatStore((state) => state.credits);
  const creditPools = useChatStore((state) => state.creditPools);
  const initials = userName.trim().slice(0, 2).toUpperCase() || "U";

  function handleNav(item: (typeof topNavItems)[number]): void {
    if (item.action === "new-chat") {
      startNewConversation();
      onSelectView("chat");
      return;
    }
    if (item.action === "search") {
      onOpenSearch();
      return;
    }
    if (item.action === "new-project") {
      onOpenNewProject();
      return;
    }
    if (item.view) {
      onSelectView(item.view);
    }
  }

  return (
    <>
      <div className="home-sidebar-shell pointer-events-auto relative flex h-full w-[84px] flex-col items-center px-2 pb-5 pt-5 text-white">
        <BrandMark inverse />

        <button
          type="button"
          title="默认项目"
          className="mt-3 rounded-full bg-white/[.08] px-2.5 py-1 text-[11px] text-white/70 backdrop-blur transition hover:bg-white/[.12] hover:text-white"
          onClick={onOpenNewProject}
        >
          默认项目
        </button>

        <nav className="mt-6 flex flex-col items-center gap-2">
          {topNavItems.map((item) => (
            <SidebarNavButton
              key={item.label}
              label={item.label}
              icon={item.icon}
              active={item.view ? activeView === item.view : false}
              onClick={() => handleNav(item)}
            />
          ))}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => setPlansOpen(true)}
            className="rounded-xl border border-cyan-300/10 bg-white/[.07] px-2.5 py-2 text-center text-[11px] leading-4 text-cyan-300 shadow-[0_12px_30px_rgba(0,0,0,.24)] transition hover:bg-white/[.11]"
          >
            <span className="block">标准版</span>
            <span className="block font-semibold text-cyan-200">✦ {formatCredits(credits)}</span>
          </button>
          <ProfileMenu userName={userName} userEmail={userEmail} initials={initials} />
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/62 transition hover:bg-white/10 hover:text-white"
            aria-label="消息通知"
          >
            <Bell className="h-5 w-5" />
          </button>
          <MoreMenu />
        </div>
      </div>
      <MembershipDialog
        open={plansOpen}
        onOpenChange={setPlansOpen}
        credits={credits}
        creditPools={creditPools}
      />
    </>
  );
}

export function Sidebar(props: SidebarProps) {
  const sidebarOpen = useChatStore((state) => state.sidebarOpen);
  const setSidebarOpen = useChatStore((state) => state.setSidebarOpen);

  return (
    <>
      <aside className="pointer-events-none fixed inset-y-0 left-0 z-30 hidden w-[92px] bg-transparent md:block">
        <SidebarBody {...props} />
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent className="w-[92px] border-r-0 bg-black/70 p-0 shadow-none backdrop-blur-xl md:hidden">
          <SidebarBody {...props} />
        </SheetContent>
      </Sheet>
    </>
  );
}
