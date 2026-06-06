"use client";

import { ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const apps = [
  ["Ps", "Adobe Photoshop", "编辑及变换您的图像", "bg-sky-950 text-sky-300"],
  ["A", "Airtable", "Add structured data to 镜刻", "bg-slate-950 text-white"],
  ["AT", "AllTrails", "Discover your next hike", "bg-emerald-950 text-lime-300"],
  ["♫", "Apple Music", "Build playlists and find music", "bg-rose-500 text-white"],
  ["B.", "Booking.com", "Find stays and rental cars", "bg-blue-700 text-white"],
  ["C", "Canva", "Search, create, edit designs", "bg-gradient-to-br from-cyan-500 to-violet-600 text-white"],
  ["↗", "Expedia", "Plan trips, flights and hotels", "bg-yellow-400 text-slate-900"],
  ["F", "Figma", "Make diagrams and slides", "bg-pink-500 text-white"],
  ["I", "Instacart", "Groceries and more delivered", "bg-lime-500 text-white"],
  ["L", "Lovable", "Build apps and websites", "bg-orange-400 text-white"]
] as const;

export function AppsView() {
  return (
    <section className="mx-auto w-full max-w-[816px] flex-1 px-6 pb-10 pt-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">应用</h1>
          <p className="mt-1 text-base text-muted-foreground">在镜刻中与你喜爱的应用对话</p>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索应用" className="h-10 w-64 rounded-full pl-11" />
        </div>
      </div>
      <div className="relative mt-7 h-80 overflow-hidden rounded-[32px] bg-gradient-to-br from-cyan-600 via-sky-300 to-yellow-100 p-8">
        <div className="absolute -bottom-20 right-28 h-64 w-64 rounded-full bg-white/45 blur-3xl" />
        <div className="relative z-10 max-w-sm text-white">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-purple-600 text-3xl italic">
            C
          </div>
          <h2 className="text-3xl font-medium">使用 Canva 进行创作</h2>
          <p className="mt-2 text-lg">制作设计与宣传单</p>
          <Button className="mt-5 rounded-full bg-black px-7 text-white hover:bg-black/85">查看</Button>
        </div>
        <div className="absolute bottom-[-10px] right-14 w-72 rotate-1 rounded-3xl bg-white p-3 shadow-xl">
          <div className="flex gap-2">
            <div className="h-32 flex-1 rounded-xl bg-rose-50 p-3 text-xl font-bold leading-5 text-red-500">
              FLIPPIN&apos; DELICIOUS
            </div>
            <div className="h-32 flex-1 rounded-xl bg-red-500 p-3 text-xl font-bold leading-5 text-white">
              THE BEST
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-700">
            Coming right up! Here are some social media posts with the perfect look and feel.
          </p>
        </div>
      </div>
      <div className="mt-7 flex gap-2">
        {["精选", "Lifestyle", "Productivity"].map((category, index) => (
          <Button
            key={category}
            variant={index === 0 ? "secondary" : "ghost"}
            className="rounded-full font-normal"
          >
            {category}
          </Button>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-x-8 md:grid-cols-2">
        {apps.map(([initial, name, description, badgeClass]) => (
          <Button
            type="button"
            variant="ghost"
            key={name}
            className="h-auto w-full justify-start gap-4 rounded-none border-b border-border/40 px-0 py-3 text-left font-normal hover:bg-accent/40"
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${badgeClass}`}
            >
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{name}</span>
              <span className="block truncate text-sm text-muted-foreground">{description}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Button>
        ))}
      </div>
    </section>
  );
}
