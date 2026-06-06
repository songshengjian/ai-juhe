"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  FileText,
  MoreHorizontal,
  Music,
  Play,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Volume2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const voices = [
  {
    id: "warm",
    name: "温柔女声",
    tone: "自然",
    scene: "亲切",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80"
  },
  {
    id: "calm",
    name: "沉稳男声",
    tone: "深沉",
    scene: "可靠",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80"
  },
  {
    id: "kid",
    name: "活泼童声",
    tone: "可爱",
    scene: "清晰",
    avatar: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=160&q=80"
  },
  {
    id: "anchor",
    name: "知性播音",
    tone: "专业",
    scene: "清晰",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=160&q=80"
  },
  {
    id: "support",
    name: "客服女声",
    tone: "耐心",
    scene: "亲切",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=160&q=80"
  },
  {
    id: "nature",
    name: "纪录片旁白",
    tone: "磁性",
    scene: "大气",
    avatar: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=160&q=80"
  }
];

const recentAudios = [
  ["晨光山谷的温柔时光", "00:58", "MP3", "今天 14:32"],
  ["产品介绍_知性播音版", "01:12", "MP3", "今天 11:08"],
  ["广告配音_活泼童声", "00:36", "MP3", "昨天 16:45"],
  ["纪录片旁白_自然风光", "02:05", "WAV", "昨天 10:21"],
  ["客服问候语_女声", "00:20", "MP3", "05-27 15:30"]
];

const templates = ["有声书", "广告宣传", "新闻播报", "产品介绍", "知识科普", "儿童故事"];
const audioModel = "Doubao-Seed-2.0-mini";

function StepBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
      {children}
    </span>
  );
}

function RangeControl({
  label,
  minLabel,
  maxLabel,
  valueLabel,
  defaultValue
}: {
  label: string;
  minLabel: string;
  maxLabel: string;
  valueLabel: string;
  defaultValue: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{valueLabel}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        defaultValue={defaultValue}
        className="h-1.5 w-full accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

function ToggleSetting({
  title,
  description,
  enabled = true
}: {
  title: string;
  description: string;
  enabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-r pr-6 last:border-r-0 last:pr-0">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{description}</div>
      </div>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          enabled ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
            enabled ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </span>
    </div>
  );
}

function Waveform({ active }: { active: boolean }) {
  const bars = useMemo(() => Array.from({ length: 54 }, (_, index) => 12 + ((index * 17) % 34)), []);
  return (
    <div className="flex h-16 flex-1 items-center gap-1 overflow-hidden">
      {bars.map((height, index) => (
        <span
          key={index}
          className={cn("w-1 rounded-full bg-muted-foreground/25", active && index < 32 && "bg-primary/50")}
          style={{ height }}
        />
      ))}
    </div>
  );
}

export function AudioView() {
  const [selectedVoice, setSelectedVoice] = useState(voices[0]?.id ?? "warm");
  const [text, setText] = useState(
    "在晨光熹微的山谷中，微风轻拂过树梢，带来一阵清新的气息。远处的溪流潺潺流淌，仿佛在低声诉说着古老的故事。每一片叶子都闪烁着露珠的光芒，像是大自然精心镶嵌的宝石。\n\n我们总是在忙碌中追逐着未来，却常常忘记了停下脚步，去感受身边的美好。也许，真正的幸福并不在于拥有多少，而在于用心去体会生活中的每一个瞬间。"
  );
  const [progress, setProgress] = useState(0);
  const [generatedText, setGeneratedText] = useState("");
  const [error, setError] = useState("");
  const isGenerating = progress > 0 && progress < 100;

  useEffect(() => {
    if (!isGenerating) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setProgress((current) => Math.min(100, current + 8));
    }, 260);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  async function startGeneration(): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    setError("");
    setGeneratedText("");
    setProgress(1);
    const formData = new FormData();
    formData.set("type", "voice");
    formData.set("prompt", trimmed);
    formData.set("ratio", "16:9");
    formData.set("duration", "5s");
    formData.set("resolution", "2K");
    formData.set("outputCount", "1");
    formData.set("model", audioModel);
    try {
      const response = await fetch("/api/generation", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => null)) as { resultText?: string; error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "音频模型调用失败");
      }
      setGeneratedText(payload?.resultText || "模型已完成处理。");
      setProgress(100);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "音频模型调用失败");
      setProgress(0);
    }
  }

  return (
    <section className="h-full overflow-y-auto px-4 pb-10 md:px-8">
      <div className="mx-auto grid w-full max-w-[1600px] gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="min-w-0 pt-5">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">文本转语音 · TTS 工作台</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                将文本转换为自然、流畅的语音，支持多种音色、情绪与语速调节，适用于有声读物、广告配音、视频解说等场景。
              </p>
              <p className="mt-2 text-xs text-primary">当前模型：{audioModel}</p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0">
              <CircleHelp className="h-4 w-4" />
              使用指南
            </Button>
          </div>

          <div className="space-y-5">
            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StepBadge>1</StepBadge>
                  <h2 className="text-base font-semibold">选择音色</h2>
                </div>
                <Button variant="outline" size="sm">
                  <BookOpenText className="h-4 w-4" />
                  更多音色
                </Button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {voices.map((voice) => {
                  const active = selectedVoice === voice.id;
                  return (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => setSelectedVoice(voice.id)}
                      className={cn(
                        "relative flex min-h-[118px] min-w-[188px] items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-accent",
                        active && "border-primary bg-primary/5"
                      )}
                    >
                      <span
                        className="h-20 w-20 shrink-0 rounded-lg bg-cover bg-center"
                        style={{ backgroundImage: `url(${voice.avatar})` }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{voice.name}</span>
                        <span className="mt-2 flex flex-wrap gap-1">
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {voice.tone}
                          </span>
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {voice.scene}
                          </span>
                        </span>
                      </span>
                      <span className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full border bg-background">
                        <Play className="h-3.5 w-3.5" />
                      </span>
                      {active ? (
                        <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Sparkles className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-xl border bg-background px-3 py-2">
                <span className="shrink-0 text-sm text-muted-foreground">自定义音色描述</span>
                <input
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="请生成温暖、亲切、有磁性的女声，语调柔和，适合情感类内容。"
                />
                <span className="text-xs text-muted-foreground">20/300</span>
                <Button variant="outline" size="sm">应用</Button>
              </div>
            </section>

            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StepBadge>2</StepBadge>
                  <h2 className="text-base font-semibold">输入或粘贴文本</h2>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4" />
                    导入文本
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setText("")}>
                    <Trash2 className="h-4 w-4" />
                    清空文本
                  </Button>
                </div>
              </div>
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="min-h-[178px] rounded-xl border bg-background p-4 text-sm leading-7"
              />
              <div className="mt-2 text-right text-xs text-muted-foreground">
                字符统计：{text.length}/5000
              </div>
            </section>

            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <StepBadge>3</StepBadge>
                <h2 className="text-base font-semibold">音频参数设置</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5">
                <RangeControl label="语速" minLabel="0.5x" maxLabel="2.0x" valueLabel="1.00x" defaultValue={38} />
                <RangeControl label="音调" minLabel="-50" maxLabel="50" valueLabel="0" defaultValue={50} />
                <RangeControl label="情感强度" minLabel="0%" maxLabel="100%" valueLabel="60%" defaultValue={60} />
                <label className="space-y-2 text-sm">
                  <span>停顿</span>
                  <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none">
                    <option>自然停顿</option>
                    <option>更短停顿</option>
                    <option>长句停顿</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span>发音风格</span>
                  <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none">
                    <option>默认</option>
                    <option>播客</option>
                    <option>广告</option>
                  </select>
                </label>
              </div>
              <div className="mt-6 grid gap-4 border-t pt-4 lg:grid-cols-4">
                <ToggleSetting title="多音字优化" description="智能识别多音字，优化发音" />
                <ToggleSetting title="数字读法" description="智能识别数字，优化读法" />
                <ToggleSetting title="插入停顿" description="根据标点自动插入停顿" />
                <ToggleSetting title="背景音乐" description="添加背景音乐（可选）" enabled={false} />
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button variant="outline" className="min-w-36">
                <Trash2 className="h-4 w-4" />
                清空文本
              </Button>
              <Button variant="outline" className="min-w-44">
                <Save className="h-4 w-4" />
                保存为音色模板
              </Button>
              <Button variant="outline" className="min-w-52">
                <Play className="h-4 w-4" />
                试听生成（前100字）
              </Button>
              <Button className="min-w-56" onClick={() => void startGeneration()}>
                <Volume2 className="h-4 w-4" />
                {isGenerating ? `生成中 ${progress}%` : progress === 100 ? "重新生成" : "开始合成"}
              </Button>
            </div>
            {error ? <div className="text-right text-sm text-destructive">{error}</div> : null}
          </div>
        </div>

        <aside className="space-y-5 pt-5 xl:sticky xl:top-0 xl:h-screen xl:overflow-y-auto xl:pb-8">
          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StepBadge>4</StepBadge>
                <h2 className="font-semibold">预览与结果</h2>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                {progress === 100 ? "已生成" : isGenerating ? "生成中" : "待生成"}
              </span>
            </div>
            <div className="rounded-xl border bg-background p-3">
              {generatedText ? (
                <p className="mb-3 rounded-lg bg-muted p-3 text-sm leading-6 text-muted-foreground">{generatedText}</p>
              ) : null}
              <div className="flex items-center gap-3">
                <Button size="icon" className="rounded-full">
                  <Play className="h-4 w-4" />
                </Button>
                <Waveform active={progress > 0} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                <span className="ml-auto">00:00 / {progress === 100 ? "01:08" : "00:00"}</span>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="text-sm">导出格式</div>
              <div className="grid grid-cols-4 gap-2">
                {["MP3", "WAV", "OGG", "AAC"].map((format, index) => (
                  <button
                    key={format}
                    type="button"
                    className={cn(
                      "h-9 rounded-lg border text-sm",
                      index === 0 && "border-primary bg-primary/5 text-primary"
                    )}
                  >
                    {format}
                  </button>
                ))}
              </div>
              <label className="block space-y-2 text-sm">
                <span>音质</span>
                <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none">
                  <option>高音质（192kbps）</option>
                  <option>标准（128kbps）</option>
                  <option>无损 WAV</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button>
                  <Download className="h-4 w-4" />
                  下载音频
                </Button>
                <Button variant="outline">
                  <Copy className="h-4 w-4" />
                  复制链接
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">最近生成</h2>
              <Button variant="ghost" size="sm">
                更多记录
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {recentAudios.map(([title, duration, format, time]) => (
                <div key={title} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border bg-background">
                    <Play className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{title}</span>
                    <span className="text-xs text-muted-foreground">{time}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{duration}</span>
                  <span className="rounded-md border px-2 py-1 text-xs">{format}</span>
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">推荐模板</h2>
              <Button variant="ghost" size="sm">
                更多模板
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <button key={template} type="button" className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">
                  {template}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="h-4 w-4" />
              快速工作流
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <button type="button" className="rounded-lg border px-3 py-2 hover:bg-accent">
                <FileText className="mr-2 inline h-4 w-4" />
                长文旁白
              </button>
              <button type="button" className="rounded-lg border px-3 py-2 hover:bg-accent">
                <Music className="mr-2 inline h-4 w-4" />
                配乐口播
              </button>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
