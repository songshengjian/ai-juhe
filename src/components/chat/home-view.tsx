"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  ImagePlus,
  Menu,
  Pause,
  Play,
  Sparkles,
  UserRound,
  Video
} from "lucide-react";

import {
  GenerationComposer,
  type CreationType,
  type GenerationJob
} from "@/components/chat/generate-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type HomeTab = "发现" | "广告/营销" | "剧场" | "美学";
type ShowcaseKind = "video" | "image" | "avatar";

interface ShowcaseItem {
  id: string;
  title: string;
  category: HomeTab;
  kind: ShowcaseKind;
  description: string;
  prompt: string;
  imageUrl: string;
  accent: string;
  duration?: string;
  model: string;
  meta: string;
}

const tabs: HomeTab[] = ["发现", "广告/营销", "剧场", "美学"];

const backgroundSlides = [
  {
    title: "Neon Portrait",
    imageUrl:
      "https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=2400&q=85"
  },
  {
    title: "Paint River",
    imageUrl:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=2400&q=85"
  },
  {
    title: "Ocean Current",
    imageUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2400&q=85"
  },
  {
    title: "Glass Creature",
    imageUrl:
      "https://images.unsplash.com/photo-1545671913-b89ac1b4ac10?auto=format&fit=crop&w=2400&q=85"
  },
  {
    title: "Color Burst",
    imageUrl:
      "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=2400&q=85"
  }
] as const;

const quickActions: Array<{
  label: string;
  description: string;
  type: CreationType;
  icon: LucideIcon;
}> = [
  { label: "Seedance 1.0 Fast", description: "电影级运动与镜头调度", type: "video", icon: Sparkles },
  { label: "图片生成", description: "海报、人像、商品和风格图", type: "image", icon: ImagePlus },
  { label: "视频生成", description: "首尾帧、参考素材到成片", type: "video", icon: Video },
  { label: "数字人", description: "口播、讲解和角色演绎", type: "avatar", icon: UserRound }
];

const quickActionArtworks = [
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=900&q=82"
] as const;

const showcaseItems: ShowcaseItem[] = [
  {
    id: "future-city",
    title: "YEAR 2799 城市开场",
    category: "发现",
    kind: "video",
    description: "高空俯冲进入未来城市，适合科幻短片开场和产品发布预热视频。",
    prompt: "未来城市上空的巨型环形屏幕，飞行器掠过云层，镜头缓慢推进，电影感蓝黑调。",
    imageUrl:
      "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=82",
    accent: "from-cyan-300/40 via-blue-500/20 to-black",
    duration: "03:27",
    model: "Seedance 1.0 Fast",
    meta: "16:9 · 4K"
  },
  {
    id: "black-rose",
    title: "黑玫瑰粉尘特写",
    category: "美学",
    kind: "video",
    description: "黑色花瓣被银色粒子包裹，适合奢侈品、香氛和高级视觉 KV。",
    prompt: "黑玫瑰在暗场中缓慢绽放，银色粉尘环绕，浅景深，微距摄影，水晶质感。",
    imageUrl:
      "https://images.unsplash.com/photo-1496062031456-07b8f162a322?auto=format&fit=crop&w=1200&q=82",
    accent: "from-slate-200/35 via-zinc-500/15 to-black",
    duration: "00:12",
    model: "Seedance 1.0 Fast",
    meta: "9:16 · 2K"
  },
  {
    id: "orange-rider",
    title: "极简骑行海报",
    category: "广告/营销",
    kind: "image",
    description: "高识别度橙青配色，适合户外品牌、旅行路线和节日海报。",
    prompt: "橙色骑行者穿过几何墙面，青色天空，极简构图，强烈阳光，高级平面广告。",
    imageUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=82",
    accent: "from-orange-300/35 via-teal-300/20 to-black",
    model: "Doubao-Seedream-5.0-lite",
    meta: "3:4 · 海报"
  },
  {
    id: "drama-face",
    title: "国风角色口播",
    category: "剧场",
    kind: "avatar",
    description: "角色保持稳定表演，口型同步适合短剧预告、解说和知识账号。",
    prompt: "国风少女角色面对镜头讲述剧情，金色光线穿过戏台，表情灵动，轻微推镜。",
    imageUrl:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=82",
    accent: "from-amber-300/35 via-rose-400/20 to-black",
    duration: "00:18",
    model: "数字人快速模式",
    meta: "口播 · 普通话"
  },
  {
    id: "brand-wave",
    title: "新品发布液态舞台",
    category: "广告/营销",
    kind: "video",
    description: "液态材质在产品背后展开，适合手机、汽车和智能硬件发布片。",
    prompt: "黑色舞台上液态金属形成波浪，产品轮廓从光线中出现，橙蓝对比，广告大片。",
    imageUrl:
      "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=82",
    accent: "from-sky-300/30 via-orange-400/25 to-black",
    duration: "00:24",
    model: "Seedance 1.0 Fast",
    meta: "21:9 · 商业"
  },
  {
    id: "silver-mask",
    title: "银色面具角色设定",
    category: "美学",
    kind: "image",
    description: "银色面具与暗红服装形成强对比，适合角色概念图和封面。",
    prompt: "戴银色面具的角色站在暗红丝绒幕前，柔光轮廓，高级时装摄影。",
    imageUrl:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=82",
    accent: "from-red-300/30 via-zinc-300/20 to-black",
    model: "Doubao-Seedream-5.0-lite",
    meta: "2:3 · 角色"
  },
  {
    id: "forest-gate",
    title: "森林门廊电影镜头",
    category: "剧场",
    kind: "video",
    description: "浓雾森林里出现发光门廊，适合奇幻短片和悬疑片转场。",
    prompt: "镜头穿过潮湿森林，远处门廊散发蓝绿色光，雾气流动，电影级景深。",
    imageUrl:
      "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=82",
    accent: "from-emerald-300/30 via-cyan-300/15 to-black",
    duration: "00:20",
    model: "Seedance 1.0 Fast",
    meta: "16:9 · 剧情"
  },
  {
    id: "cosmetic-pack",
    title: "护肤品透明质感套图",
    category: "广告/营销",
    kind: "image",
    description: "透明亚克力、水面反射和柔光瓶身，适合电商主图和详情页头图。",
    prompt: "护肤品瓶身立在透明亚克力水台上，清晨光，水面反射，纯净商业摄影。",
    imageUrl:
      "https://images.unsplash.com/photo-1556228724-4f7c2b356b4f?auto=format&fit=crop&w=1200&q=82",
    accent: "from-cyan-100/35 via-white/15 to-black",
    model: "Doubao-Seedream-5.0-lite",
    meta: "1:1 · 电商"
  },
  {
    id: "stage-dance",
    title: "霓虹舞台动作捕捉",
    category: "发现",
    kind: "video",
    description: "舞者动作带出流光轨迹，可做音乐视觉、舞蹈挑战和 MV 分镜。",
    prompt: "黑色舞台上的舞者旋转，霓虹光轨跟随动作，低角度镜头，节奏强烈。",
    imageUrl:
      "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1200&q=82",
    accent: "from-fuchsia-300/35 via-blue-400/20 to-black",
    duration: "00:16",
    model: "Seedance 1.0 Fast",
    meta: "9:16 · MV"
  },
  {
    id: "paper-world",
    title: "纸艺微缩世界",
    category: "美学",
    kind: "image",
    description: "纸艺层叠的城市、山脉和海面，适合童书、教育和品牌插画。",
    prompt: "纸艺微缩世界，层叠城市和海浪，柔和天光，干净高级的手工材质。",
    imageUrl:
      "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=82",
    accent: "from-sky-200/35 via-lime-200/15 to-black",
    model: "Doubao-Seedream-5.0-lite",
    meta: "4:3 · 插画"
  },
  {
    id: "detective-room",
    title: "雨夜侦探室",
    category: "剧场",
    kind: "video",
    description: "窗外霓虹和雨滴形成强烈叙事氛围，适合短剧片头。",
    prompt: "侦探坐在昏暗办公室，窗外霓虹雨夜，烟雾缓慢飘动，镜头横移。",
    imageUrl:
      "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=82",
    accent: "from-indigo-300/35 via-rose-300/15 to-black",
    duration: "00:22",
    model: "Seedance 1.0 Fast",
    meta: "16:9 · 悬疑"
  },
  {
    id: "social-ad",
    title: "社媒闪屏广告",
    category: "广告/营销",
    kind: "video",
    description: "快节奏切换的活动视觉，适合新品促销和直播预告。",
    prompt: "彩色粉末炸开形成品牌字样，镜头快速推拉，背景黑色，强节奏社媒广告。",
    imageUrl:
      "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1200&q=82",
    accent: "from-yellow-300/40 via-fuchsia-400/20 to-black",
    duration: "00:10",
    model: "Seedance 1.0 Fast",
    meta: "9:16 · 广告"
  },
  {
    id: "soft-portrait",
    title: "柔光人像写真",
    category: "美学",
    kind: "image",
    description: "浅色背景与柔和轮廓光，适合头像、人物海报和杂志封面。",
    prompt: "自然光人像，浅色背景，柔和轮廓光，细腻皮肤质感，杂志封面构图。",
    imageUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=82",
    accent: "from-rose-200/35 via-white/15 to-black",
    model: "Doubao-Seedream-5.0-lite",
    meta: "3:4 · 人像"
  },
  {
    id: "robot-host",
    title: "科技主持数字人",
    category: "发现",
    kind: "avatar",
    description: "科技感主持人播报产品更新，适合企业内训和发布会视频。",
    prompt: "未来感主持人在透明屏前讲解产品，蓝色 UI 浮层，专业自信，口型自然。",
    imageUrl:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=82",
    accent: "from-blue-300/35 via-cyan-300/15 to-black",
    duration: "00:30",
    model: "数字人大师模式",
    meta: "企业讲解"
  },
  {
    id: "water-car",
    title: "汽车水幕大片",
    category: "广告/营销",
    kind: "video",
    description: "车辆穿过巨型水幕和灯阵，适合汽车视觉广告。",
    prompt: "黑色汽车穿过水幕，灯阵反射在车身，低机位跟拍，商业大片质感。",
    imageUrl:
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=82",
    accent: "from-blue-200/30 via-zinc-300/15 to-black",
    duration: "00:18",
    model: "Seedance 1.0 Fast",
    meta: "21:9 · 汽车"
  },
  {
    id: "space-opera",
    title: "太空歌剧分镜",
    category: "剧场",
    kind: "video",
    description: "巨型舰队穿越星云，适合科幻长片概念和预告片镜头。",
    prompt: "巨型舰队穿越红蓝星云，镜头从舰尾推进到行星边缘，宏大太空歌剧。",
    imageUrl:
      "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=82",
    accent: "from-purple-300/35 via-red-400/15 to-black",
    duration: "00:26",
    model: "Seedance 1.0 Fast",
    meta: "16:9 · 科幻"
  }
];

function getCardLayout(index: number): string {
  if (index % 7 === 0) {
    return "md:col-span-2 md:row-span-2 aspect-[16/10]";
  }
  if (index % 5 === 0) {
    return "aspect-[4/5]";
  }
  if (index % 3 === 0) {
    return "aspect-[3/4]";
  }
  return "aspect-[4/3]";
}

function HomeShowcaseCard({
  item,
  index,
  onOpen
}: {
  item: ShowcaseItem;
  index: number;
  onOpen: (item: ShowcaseItem) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`打开 ${item.title}`}
      onClick={() => onOpen(item)}
      className={cn(
        "group relative min-h-[220px] overflow-hidden rounded-[8px] border border-white/10 bg-zinc-950 text-left shadow-2xl shadow-black/25 outline-none transition duration-300 hover:-translate-y-1 hover:border-white/35 focus-visible:ring-2 focus-visible:ring-white/70",
        getCardLayout(index)
      )}
      style={{ backgroundImage: `linear-gradient(135deg, rgba(8,8,10,.88), rgba(8,8,10,.2))` }}
    >
      <Image
        src={item.imageUrl}
        alt={item.title}
        fill
        unoptimized
        loading="lazy"
        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
        className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
      />
      <div className={cn("absolute inset-0 bg-gradient-to-t", item.accent)} />
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
        {item.duration ? (
          <span className="rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur">
            {item.duration}
          </span>
        ) : (
          <span className="rounded-md bg-white/15 px-2 py-1 text-xs font-medium text-white backdrop-blur">
            {item.kind === "avatar" ? "数字人" : "图片"}
          </span>
        )}
        <span className="rounded-full bg-white/15 p-2 text-white backdrop-blur transition group-hover:bg-white/25">
          {item.kind === "image" ? <ArrowUpRight className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="rounded-[8px] border border-white/10 bg-black/35 p-3 text-white opacity-0 backdrop-blur-md transition duration-300 group-hover:opacity-100">
          <div className="text-sm font-semibold">{item.title}</div>
          <div className="mt-1 line-clamp-2 text-xs text-white/70">{item.description}</div>
        </div>
      </div>
    </button>
  );
}

function ShowcaseDialog({
  item,
  onOpenChange
}: {
  item: ShowcaseItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
  }, [item?.id]);

  useEffect(() => {
    if (!playing) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setProgress((current) => (current >= 100 ? 0 : current + 2));
    }, 180);
    return () => window.clearInterval(timer);
  }, [playing]);

  if (!item) {
    return null;
  }

  const isPlayable = item.kind !== "image";

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden border-white/10 bg-[#050507] p-0 text-white">
        <div className="grid max-h-[92vh] overflow-y-auto lg:grid-cols-[1.35fr_.65fr]">
          <div className="relative min-h-[420px] bg-black">
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              unoptimized
              sizes="(min-width: 1024px) 65vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />
            {isPlayable ? (
              <button
                type="button"
                onClick={() => setPlaying((current) => !current)}
                className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white backdrop-blur transition hover:bg-white/20"
                aria-label={playing ? "暂停播放" : "播放作品"}
              >
                {playing ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 fill-white" />}
              </button>
            ) : null}
            <div className="absolute inset-x-6 bottom-6">
              <div className="mb-3 flex items-center justify-between text-xs text-white/75">
                <span>{item.model}</span>
                <span>{item.duration ?? item.meta}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/20">
                <div
                  className={cn("h-full rounded-full bg-white transition-all", !isPlayable && "w-full opacity-40")}
                  style={{ width: isPlayable ? `${progress}%` : undefined }}
                />
              </div>
            </div>
          </div>
          <aside className="flex min-h-[420px] flex-col p-6">
            <div className="mb-4 flex items-center gap-2 text-xs text-white/60">
              <span className="rounded-full border border-white/15 px-3 py-1">{item.category}</span>
              <span>{item.meta}</span>
            </div>
            <DialogTitle className="pr-10 text-2xl font-semibold text-white">{item.title}</DialogTitle>
            <DialogDescription className="mt-3 text-sm leading-6 text-white/70">
              {item.description}
            </DialogDescription>
            <div className="mt-6 rounded-[8px] border border-white/10 bg-white/[.06] p-4">
              <div className="mb-2 text-xs font-medium text-white/50">提示词</div>
              <p className="text-sm leading-6 text-white/85">{item.prompt}</p>
            </div>
            <div className="mt-auto grid grid-cols-3 gap-2 pt-6 text-center text-xs text-white/70">
              <div className="rounded-[8px] bg-white/[.06] p-3">
                <div className="text-base font-semibold text-white">{item.kind === "image" ? "图像" : "视频"}</div>
                <div className="mt-1">类型</div>
              </div>
              <div className="rounded-[8px] bg-white/[.06] p-3">
                <div className="text-base font-semibold text-white">4K</div>
                <div className="mt-1">质感</div>
              </div>
              <div className="rounded-[8px] bg-white/[.06] p-3">
                <div className="text-base font-semibold text-white">AI</div>
                <div className="mt-1">生成</div>
              </div>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function HomeView({
  onOpenGenerateTemplate,
  onGenerateJob,
  onGenerationUpdate,
  onOpenMenu
}: {
  onOpenGenerateTemplate: (type: CreationType) => void;
  onGenerateJob: (job: GenerationJob) => void;
  onGenerationUpdate: (jobId: string, patch: Partial<GenerationJob>) => void;
  onOpenMenu: () => void;
}) {
  const [activeBackgroundIndex, setActiveBackgroundIndex] = useState(0);
  const [activeType, setActiveType] = useState<CreationType>("agent");
  const [activeTab, setActiveTab] = useState<HomeTab>("发现");
  const [visibleCount, setVisibleCount] = useState(8);
  const [selectedItem, setSelectedItem] = useState<ShowcaseItem | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveBackgroundIndex((current) => (current + 1) % backgroundSlides.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, []);

  const filteredItems = useMemo(() => {
    if (activeTab === "发现") {
      return showcaseItems;
    }
    return showcaseItems.filter((item) => item.category === activeTab);
  }, [activeTab]);

  const visibleItems = filteredItems.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(8);
  }, [activeTab]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setVisibleCount((current) => Math.min(current + 6, filteredItems.length));
        }
      },
      { rootMargin: "480px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredItems.length]);

  return (
    <section className="dark relative h-full overflow-y-auto bg-black text-white">
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute left-4 top-4 z-30 border border-white/10 bg-white/10 text-white backdrop-blur hover:bg-white/20 md:hidden"
        aria-label="打开侧栏"
        onClick={onOpenMenu}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="pointer-events-none fixed inset-0 hidden overflow-hidden bg-black md:block">
        {backgroundSlides.map((slide, index) => (
          <Image
            key={slide.title}
            src={slide.imageUrl}
            alt=""
            fill
            unoptimized
            priority={index === 0}
            sizes="100vw"
            className={cn(
              "absolute inset-0 h-full w-full scale-105 object-cover opacity-0 transition-opacity duration-1000 home-bg-pan",
              index === activeBackgroundIndex && "opacity-100"
            )}
          />
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.52)_52%,#000_88%)]" />
        <div className="home-fluid-surface absolute inset-0 opacity-70" />
        <div className="home-scanlines absolute inset-0 opacity-25" />
      </div>

      <div className="pointer-events-none fixed inset-0 overflow-hidden bg-black md:hidden">
        {backgroundSlides.map((slide, index) => (
          <Image
            key={slide.title}
            src={slide.imageUrl}
            alt=""
            fill
            unoptimized
            priority={index === 0}
            sizes="100vw"
            className={cn(
              "absolute inset-0 h-full w-full scale-105 object-cover opacity-0 transition-opacity duration-1000 home-bg-pan",
              index === activeBackgroundIndex && "opacity-100"
            )}
          />
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.58)_48%,#000_82%)]" />
        <div className="home-fluid-surface absolute inset-0 opacity-70" />
        <div className="home-scanlines absolute inset-0 opacity-25" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[1800px] flex-col px-5 pb-16 pt-24 md:px-10 lg:px-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
          <h1 className="text-[44px] font-semibold leading-tight text-white drop-shadow-2xl md:text-[78px]">
            <span className="hero-brush-word mr-2 inline-block align-baseline text-[1.18em] text-white">万镜</span>
            <span className="text-white/70">生辉</span>
            <span className="mx-5 text-white/45">·</span>
            <span className="hero-brush-word mr-2 inline-block align-baseline text-[1.18em] text-white">一刻</span>
            <span className="text-white/70">成片</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72 md:text-base">
            把想法、参考图、镜头语言和角色诉求放进来，首页直接进入图像、视频与数字人的创作链路。
          </p>
        </div>

        <div className="mx-auto mt-8 w-full max-w-5xl">
          <GenerationComposer
            selectedCreationType={activeType}
            onCreationTypeChange={setActiveType}
            onGenerate={onGenerateJob}
            onGenerationUpdate={onGenerationUpdate}
            className="max-w-none"
            panelClassName="border-white/15 bg-black/45 shadow-2xl shadow-black/30 backdrop-blur-xl"
            helperClassName="text-white/60"
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            const artwork = quickActionArtworks[index % quickActionArtworks.length];
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  setActiveType(action.type);
                  onOpenGenerateTemplate(action.type);
                }}
                className={cn(
                  "group relative min-h-[112px] overflow-hidden rounded-xl border border-white/18 bg-white/[.08] p-0 text-left text-white shadow-[0_18px_45px_rgba(0,0,0,.26),inset_0_1px_0_rgba(255,255,255,.18)] backdrop-blur-2xl transition duration-300 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/[.13]"
                )}
                style={{
                  backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.68), rgba(0,0,0,.22) 42%, rgba(255,255,255,.12) 100%), url(${artwork})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_65%_40%,rgba(83,198,255,.32),transparent_34%),linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0)_42%,rgba(0,0,0,.42))] opacity-80 transition group-hover:opacity-100" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.34),transparent_48%,rgba(0,0,0,.18)),repeating-linear-gradient(0deg,rgba(255,255,255,.07)_0_1px,transparent_1px_7px),repeating-linear-gradient(90deg,rgba(255,255,255,.055)_0_1px,transparent_1px_7px)] opacity-45" />
                {index === 0 ? (
                  <span className="absolute left-3 top-2 -rotate-12 rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-black italic text-white shadow-lg">
                    NEW
                  </span>
                ) : null}
                <ArrowUpRight className="absolute right-4 top-4 h-5 w-5 text-white/78 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                <div className="relative z-10 flex h-full min-h-[112px] flex-col justify-center px-6 py-5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-white/86" />
                    <div className="text-xl font-semibold drop-shadow-[0_2px_10px_rgba(0,0,0,.45)]">
                      {action.label}
                    </div>
                  </div>
                  <div className="mt-2 text-sm font-medium text-white/82 drop-shadow-[0_2px_8px_rgba(0,0,0,.45)]">
                    {action.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-[8px] px-4 py-2 text-sm text-white/62 transition hover:bg-white/10 hover:text-white",
                activeTab === tab && "bg-white text-black hover:bg-white hover:text-black"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-4 grid auto-rows-[220px] grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {visibleItems.map((item, index) => (
            <HomeShowcaseCard key={item.id} item={item} index={index} onOpen={setSelectedItem} />
          ))}
        </div>

        <div ref={sentinelRef} className="h-16" />
        {visibleItems.length < filteredItems.length ? (
          <div className="mb-8 text-center text-xs text-white/45">继续下滑加载更多作品</div>
        ) : null}
      </div>

      <ShowcaseDialog item={selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)} />
    </section>
  );
}
