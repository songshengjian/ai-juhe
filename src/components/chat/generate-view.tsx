"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction
} from "react";
import {
  AtSign,
  Bot,
  Box,
  Check,
  ChevronDown,
  Clock,
  Clapperboard,
  Download,
  FileAudio,
  FileImage,
  FileVideo,
  Flag,
  ImagePlus,
  MessageSquareText,
  Mic,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCcw,
  Send,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  Star,
  Trash2,
  Upload,
  UserRound,
  Video,
  Volume2,
  Wand2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { calculateGenerationCost, formatCredits } from "@/lib/generation-billing";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat-store";

export type CreationType = "agent" | "image" | "video" | "avatar" | "voice" | "motion";
type RatioId = "auto" | "21:9" | "16:9" | "3:2" | "4:3" | "1:1" | "3:4" | "2:3" | "9:16";
type ResolutionId = "2K" | "4K";
type VideoReferenceMode = "reference" | "firstLast" | "multi";
type UploadTarget =
  | { type: "materials" }
  | { type: "firstFrame" }
  | { type: "lastFrame" }
  | { type: "multiFrame"; index: number }
  | { type: "voiceClone" }
  | { type: "motionRole" }
  | { type: "motionActionVideo" };

interface MaterialItem {
  id: string;
  name: string;
  type: "image" | "video" | "audio" | "file";
  previewUrl: string | null;
  file?: File;
}

interface JobMaterialSnapshot {
  id: string;
  name: string;
  type: MaterialItem["type"];
  previewUrl: string | null;
}

export interface GenerationJob {
  id: string;
  type: CreationType;
  prompt: string;
  ratio: RatioId;
  progress: number;
  model: string;
  duration: string;
  resolution?: ResolutionId;
  createdAt: string;
  outputCount: number;
  sourceMaterials: JobMaterialSnapshot[];
  cost: number;
  status?: "running" | "submitted" | "completed" | "failed";
  outputUrls?: string[];
  resultText?: string;
  taskId?: string;
  error?: string;
}

interface GenerationDraftRequest {
  nonce: number;
  type: CreationType;
  prompt: string;
  ratio: RatioId;
}

interface GenerationApiResult {
  status: "completed" | "submitted";
  model: string;
  outputUrls: string[];
  resultText?: string;
  taskId?: string;
}

interface MultiFrameItem {
  materialId: string;
  prompt: string;
  promptOpen: boolean;
}

interface MotionTemplate {
  id: string;
  title: string;
  author: string;
  duration: string;
  imageUrl: string;
}

interface VoiceTone {
  id: string;
  name: string;
  tags: string[];
}

const creationTypes: Array<{
  id: CreationType;
  label: string;
  description: string;
  icon: typeof Bot;
}> = [
  { id: "agent", label: "Agent 模式", description: "自动拆解任务，组合图、文、音、视频能力", icon: Bot },
  { id: "image", label: "图片生成", description: "文字、参考图和主体组合生成图片", icon: ImagePlus },
  { id: "video", label: "视频生成", description: "首尾帧、参考素材和运动描述生成视频", icon: Video },
  { id: "avatar", label: "数字人", description: "角色、音色与台词合成口播视频", icon: UserRound },
  { id: "voice", label: "配音生成", description: "文本、情绪和音色生成语音", icon: Mic },
  { id: "motion", label: "动作模仿", description: "以动作参考驱动角色画面", icon: Wand2 }
];

const ratios: Array<{ id: RatioId; label: string; aspect: string; previewWidth: number }> = [
  { id: "auto", label: "智能", aspect: "16 / 9", previewWidth: 520 },
  { id: "21:9", label: "21:9", aspect: "21 / 9", previewWidth: 560 },
  { id: "16:9", label: "16:9", aspect: "16 / 9", previewWidth: 520 },
  { id: "3:2", label: "3:2", aspect: "3 / 2", previewWidth: 480 },
  { id: "4:3", label: "4:3", aspect: "4 / 3", previewWidth: 430 },
  { id: "1:1", label: "1:1", aspect: "1 / 1", previewWidth: 360 },
  { id: "3:4", label: "3:4", aspect: "3 / 4", previewWidth: 300 },
  { id: "2:3", label: "2:3", aspect: "2 / 3", previewWidth: 280 },
  { id: "9:16", label: "9:16", aspect: "9 / 16", previewWidth: 260 }
];

const resolutionOptions: Array<{ id: ResolutionId; label: string; featured?: boolean }> = [
  { id: "2K", label: "高清 2K" },
  { id: "4K", label: "超清 4K", featured: true }
];

const videoDurationOptions = Array.from({ length: 12 }, (_, index) => `${index + 4}s`);
const maxMultiFrames = 6;
const defaultImageOutputCount = 4;
const resultStageMaxWidth = 1140;
const videoResultCardWidth = 503;
const runningProgressLimit = 92;
const submittedProgressLimit = 96;

const videoReferenceModes: Array<{ id: VideoReferenceMode; label: string; description: string }> = [
  { id: "reference", label: "全能参考", description: "上传一组参考素材，自动识别图片、视频和文本线索" },
  { id: "firstLast", label: "首尾帧", description: "指定首帧和尾帧，控制画面起止状态" },
  { id: "multi", label: "智能多帧", description: "逐帧补充素材，并在帧间加入过渡提示词" }
];

const imageModels: Array<readonly [string, string]> = [
  ["Doubao-Seedream-5.0-lite", "Volcengine image generation model"],
  ["Doubao-Seedream-4.5", "Volcengine image generation model"],
  ["Doubao-Seedream-4.0", "Volcengine image generation model"]
];

const videoModels: Array<readonly [string, string]> = [
  ["Seedance 1.0 Fast", "Volcengine video content generation model"],
  ["Doubao-Seed-2.0-pro", "Omnimodal model for complex prompt and reference understanding"],
  ["Doubao-Seed-2.0-lite", "Omnimodal lightweight model"],
  ["Doubao-Seed-2.0-mini", "Omnimodal compact model"],
  ["Doubao-Seed-2.0-Code", "Omnimodal coding and structured reasoning model"]
];

const agentModels: Array<readonly [string, string]> = [
  ["Doubao-Seed-2.0-lite", "Omnimodal Agent model"],
  ["Doubao-Seed-2.0-mini", "Omnimodal lightweight model"]
];

async function requestGenerationResult(
  job: GenerationJob,
  files: File[],
  resolution: ResolutionId
): Promise<GenerationApiResult> {
  const formData = new FormData();
  formData.set("type", job.type);
  formData.set("prompt", job.prompt);
  formData.set("ratio", job.ratio);
  formData.set("duration", job.duration);
  formData.set("resolution", resolution);
  formData.set("outputCount", String(job.outputCount));
  formData.set("model", job.model);
  files.forEach((file) => formData.append("files", file, file.name));

  const response = await fetch("/api/generation", {
    method: "POST",
    body: formData
  });
  const payload = (await response.json().catch(() => null)) as
    | (GenerationApiResult & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(payload?.error || "Generation request failed.");
  }
  if (!payload) {
    throw new Error("Generation provider returned an empty response.");
  }
  return payload;
}

async function requestSubmittedGenerationResult(
  job: GenerationJob,
  taskId: string,
  model: string
): Promise<GenerationApiResult> {
  const params = new URLSearchParams({
    taskId,
    type: job.type,
    model
  });
  const response = await fetch(`/api/generation?${params.toString()}`);
  const payload = (await response.json().catch(() => null)) as
    | (GenerationApiResult & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to check generation status.");
  }
  if (!payload) {
    throw new Error("Generation provider returned an empty response.");
  }

  return payload;
}

export async function loadGenerationJobsFromDatabase(): Promise<GenerationJob[]> {
  const response = await fetch("/api/generation/jobs", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load generation jobs.");
  }
  return (await response.json()) as GenerationJob[];
}

export async function saveGenerationJobToDatabase(job: GenerationJob): Promise<void> {
  await fetch("/api/generation/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job)
  }).then((response) => {
    if (!response.ok) {
      throw new Error("Unable to save generation job.");
    }
  });
}

export async function updateGenerationJobInDatabase(
  jobId: string,
  patch: Partial<GenerationJob>
): Promise<void> {
  await fetch(`/api/generation/jobs/${encodeURIComponent(jobId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  }).then((response) => {
    if (!response.ok) {
      throw new Error("Unable to update generation job.");
    }
  });
}

export async function deleteGenerationJobFromDatabase(jobId: string): Promise<void> {
  await fetch(`/api/generation/jobs/${encodeURIComponent(jobId)}`, {
    method: "DELETE"
  }).then((response) => {
    if (!response.ok) {
      throw new Error("Unable to delete generation job.");
    }
  });
}

function isVideoCreationType(type: CreationType): boolean {
  return type === "video" || type === "motion" || type === "avatar";
}

function getVisibleOutputCount(job: GenerationJob): number {
  if (job.type === "image") {
    return Math.min(defaultImageOutputCount, Math.max(1, job.outputCount || defaultImageOutputCount));
  }
  return Math.max(1, job.outputUrls?.length || job.outputCount || 1);
}

function normalizeGenerationJob(job: GenerationJob): GenerationJob {
  if (job.status !== "failed" && job.outputUrls && job.outputUrls.length > 0) {
    return {
      ...job,
      progress: 100,
      status: "completed",
      outputCount: job.type === "image" ? Math.max(job.outputCount, job.outputUrls.length) : job.outputUrls.length
    };
  }
  if (job.status === "completed") {
    return { ...job, progress: 100 };
  }
  return job;
}

function mergeGenerationJobs(existing: GenerationJob[], incoming: GenerationJob[]): GenerationJob[] {
  const byId = new Map<string, GenerationJob>();
  [...existing, ...incoming].forEach((job) => {
    byId.set(job.id, normalizeGenerationJob({ ...byId.get(job.id), ...job }));
  });
  return Array.from(byId.values());
}

function generationResultToPatch(job: GenerationJob, result: GenerationApiResult): Partial<GenerationJob> {
  const resultOutputCount =
    job.type === "image"
      ? Math.min(defaultImageOutputCount, Math.max(job.outputCount || defaultImageOutputCount, result.outputUrls.length))
      : result.outputUrls.length > 0
        ? result.outputUrls.length
        : job.outputCount;

  return {
    progress: result.status === "completed" ? 100 : Math.max(job.progress, 76),
    status: result.status,
    model: result.model || job.model,
    outputUrls: result.outputUrls,
    outputCount: resultOutputCount,
    resultText: result.resultText,
    taskId: result.taskId
  };
}

function continueSubmittedGeneration(
  job: GenerationJob,
  result: GenerationApiResult,
  onUpdate?: (jobId: string, patch: Partial<GenerationJob>) => void
): void {
  if (!result.taskId || !isVideoCreationType(job.type) || result.status !== "submitted") {
    return;
  }

  void (async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      onUpdate?.(job.id, {
        progress: Math.min(submittedProgressLimit, 84 + attempt * 3),
        status: "submitted"
      });

      const latest = await requestSubmittedGenerationResult(job, result.taskId!, result.model || job.model);
      if (latest.status === "completed" && latest.outputUrls.length > 0) {
        onUpdate?.(job.id, generationResultToPatch(job, latest));
        return;
      }
    }
  })().catch(() => {
    onUpdate?.(job.id, {
      progress: submittedProgressLimit,
      status: "submitted"
    });
  });
}

const avatarModes: Array<readonly [string, string]> = [
  ["大师模式", "电影级的表演效果"],
  ["生动模式", "动作自然，画面清晰"],
  ["快速模式", "更低成本，快速生成"]
];

const motionModes: Array<readonly [string, string]> = [
  ["大师", "效果最佳，画质超清"],
  ["生动", "不限画幅，动效更真"],
  ["快速", "更快生成，成本更低"]
];

const motionTemplates: MotionTemplate[] = [
  {
    id: "runway-turn",
    title: "转身走位",
    author: "@ICX迷妹团",
    duration: "00:08",
    imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=480&q=80"
  },
  {
    id: "shadow-dance",
    title: "剪影舞步",
    author: "@想吃烧仙草",
    duration: "00:06",
    imageUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=480&q=80"
  },
  {
    id: "closeup-breath",
    title: "近景呼吸",
    author: "@kkgg",
    duration: "00:02",
    imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=480&q=80"
  },
  {
    id: "festival-wave",
    title: "节日挥手",
    author: "@青墨qm",
    duration: "00:09",
    imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=480&q=80"
  }
];

const voiceTones: VoiceTone[] = [
  { id: "sweet-girl", name: "甜爽女大", tags: ["多情感", "女声"] },
  { id: "low-male", name: "低音炮", tags: ["多情感", "男声"] },
  { id: "british", name: "英气飒姐", tags: ["多情感", "女声"] },
  { id: "sunny-boy", name: "阳光小男孩", tags: ["多情感", "童声"] },
  { id: "soft-girl", name: "温柔软妹", tags: ["多情感", "女声"] },
  { id: "lazy", name: "黛玉", tags: ["多情感", "角色"] },
  { id: "clear-female", name: "明媚女声", tags: ["多情感", "女声"] },
  { id: "story-male", name: "猴哥", tags: ["多情感", "男声"] },
  { id: "novel", name: "蜡笔小新", tags: ["多情感", "角色"] },
  { id: "anime", name: "动漫海绵", tags: ["多情感", "角色"] },
  { id: "tvb", name: "TVB女声", tags: ["粤语", "女声"] },
  { id: "cool-bro", name: "爽快小哥", tags: ["多情感", "男声"] }
];

const skills: Array<readonly [string, string]> = [
  ["剧情短片", "帮你自动生成故事大纲、分镜脚本并产出短片"],
  ["电商套图", "生成风格统一的商品全套视觉素材"],
  ["海报设计", "生成更有创意的海报内容，擅长营销场景"],
  ["品牌设计", "根据公司名称、业务与客群，生成品牌 Logo 和延展"]
];

const placeholders: Record<CreationType, string> = {
  agent: "输入想法、脚本或上传参考，支持 “/” 使用技能，@ 添加主体，和 Agent 一起创作",
  image: "上传参考图、输入文字或 @ 主体，描述你想生成的图片。",
  video: "上传最多12个参考素材，输入文字或 @ 参考内容，自由组合图、文、音、视频多元素，定义精彩互动。",
  avatar: "说话内容  请输入你希望角色说出的内容\n动作描述（可选）添加动作描述和镜头语言，如：镜头推进，他摘下眼镜，对着镜头笑着说",
  voice: "输入文案、选择音色和情绪，生成自然配音。",
  motion: "上传动作参考和角色素材，描述动作节奏、镜头运动和最终画面。"
};

function getRatio(ratioId: RatioId) {
  return ratios.find((ratio) => ratio.id === ratioId) ?? ratios[2]!;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSkillToken(skill: string) {
  return `/${skill}`;
}

function getSubjectToken(material: MaterialItem) {
  if (material.type === "image") {
    return "图片主体";
  }
  if (material.type === "video") {
    return "视频主体";
  }
  if (material.type === "audio") {
    return "音频主体";
  }
  return "文件主体";
}

function getRatioIconStyle(ratioId: RatioId): CSSProperties {
  return {
    width: ratioId === "9:16" ? 8 : ratioId === "21:9" ? 18 : ratioId === "1:1" ? 11 : 14,
    height: ratioId === "9:16" ? 16 : ratioId === "21:9" ? 8 : ratioId === "1:1" ? 11 : 9
  };
}

function getResolutionLabel(resolution: ResolutionId) {
  return resolutionOptions.find((option) => option.id === resolution)?.label ?? "高清 2K";
}

function getDimensions(ratioId: RatioId, resolution: ResolutionId) {
  const longEdge = resolution === "4K" ? 3840 : 2560;
  const shortEdge = resolution === "4K" ? 2160 : 1440;
  const normalizedRatio = ratioId === "auto" ? "16:9" : ratioId;

  switch (normalizedRatio) {
    case "21:9":
      return { width: longEdge, height: Math.round((longEdge / 21) * 9) };
    case "3:2":
      return { width: Math.round((shortEdge / 2) * 3), height: shortEdge };
    case "4:3":
      return { width: Math.round((shortEdge / 3) * 4), height: shortEdge };
    case "1:1":
      return { width: shortEdge, height: shortEdge };
    case "3:4":
      return { width: shortEdge, height: Math.round((shortEdge / 3) * 4) };
    case "2:3":
      return { width: shortEdge, height: Math.round((shortEdge / 2) * 3) };
    case "9:16":
      return { width: shortEdge, height: longEdge };
    case "16:9":
    default:
      return { width: longEdge, height: shortEdge };
  }
}

function getOutputUrl(job: GenerationJob, index = 0) {
  return job.outputUrls?.[index] ?? job.outputUrls?.[0];
}

function getOutputFileExtension(job: GenerationJob) {
  if (job.type === "video" || job.type === "motion" || job.type === "avatar") {
    return "mp4";
  }
  if (job.type === "voice") {
    return "mp3";
  }
  return "png";
}

function safeDownloadFileName(job: GenerationJob, index: number): string {
  const extension = getOutputFileExtension(job);
  const prefix = job.prompt.trim().slice(0, 24).replace(/[\\/:*?"<>|\r\n]+/g, "-") || "ai-juhe";
  return `${prefix}-${job.id.slice(0, 8)}-${index + 1}.${extension}`;
}

async function downloadGeneratedOutput(job: GenerationJob, index = 0): Promise<void> {
  const outputUrl = getOutputUrl(job, index);
  if (!outputUrl) {
    return;
  }
  const fileName = safeDownloadFileName(job, index);
  const proxyUrl = `/api/generation/download?url=${encodeURIComponent(outputUrl)}&filename=${encodeURIComponent(fileName)}`;
  const response = await fetch(proxyUrl);
  if (response.ok) {
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return;
  }

  const anchor = document.createElement("a");
  anchor.href = proxyUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function singleOutputJob(job: GenerationJob, index: number): GenerationJob {
  const outputUrl = getOutputUrl(job, index);
  if (!outputUrl) {
    return job;
  }
  return {
    ...job,
    outputUrls: [outputUrl],
    outputCount: 1
  };
}

function getMaterialType(file: File): MaterialItem["type"] {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("video/")) {
    return "video";
  }
  if (file.type.startsWith("audio/")) {
    return "audio";
  }
  return "file";
}

function materialIcon(type: MaterialItem["type"]) {
  if (type === "image") {
    return FileImage;
  }
  if (type === "video") {
    return FileVideo;
  }
  if (type === "audio") {
    return FileAudio;
  }
  return Upload;
}

function TypeDropdown({
  creationType,
  onChange
}: {
  creationType: CreationType;
  onChange: (type: CreationType) => void;
}) {
  const active = creationTypes.find((item) => item.id === creationType) ?? creationTypes[0]!;
  const ActiveIcon = active.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="bg-background text-primary">
          <ActiveIcon className="h-4 w-4" />
          {active.label}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60 rounded-xl p-2 shadow-xl">
        <DropdownMenuLabel>创作类型</DropdownMenuLabel>
        {creationTypes.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.id}
              onSelect={() => onChange(item.id)}
              className={cn("rounded-lg py-2.5", item.id === creationType && "bg-accent")}
            >
              <Icon className="h-4 w-4" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{item.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
              </span>
              {item.id === creationType ? <Check className="h-4 w-4" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SelectMenu({
  icon: Icon,
  label,
  items,
  active,
  onChange,
  className
}: {
  icon: typeof Box;
  label: string;
  items: Array<string | readonly [string, string]>;
  active: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn("bg-background", className)}>
          <Icon className="h-4 w-4" />
          <span className="max-w-[180px] truncate">{active}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[330px] rounded-xl p-2 shadow-xl">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {items.map((entry) => {
          const [value, description] = Array.isArray(entry) ? entry : [entry, ""];
          return (
            <DropdownMenuItem
              key={value}
              onSelect={() => onChange(value)}
              className={cn("rounded-lg py-3", value === active && "bg-accent")}
            >
              <Sparkles className="h-4 w-4" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{value}</span>
                {description ? (
                  <span className="block truncate text-xs text-muted-foreground">{description}</span>
                ) : null}
              </span>
              {value === active ? <Check className="h-4 w-4" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RatioMenu({
  ratio,
  onChange,
  compact = false,
  resolution,
  onResolutionChange
}: {
  ratio: RatioId;
  onChange: (ratio: RatioId) => void;
  compact?: boolean;
  resolution?: ResolutionId;
  onResolutionChange?: (resolution: ResolutionId) => void;
}) {
  const active = getRatio(ratio);
  const dimensions = resolution ? getDimensions(ratio, resolution) : null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="bg-background">
          <span className="rounded-sm border border-foreground/70" style={getRatioIconStyle(active.id)} />
          {active.label}
          {resolution ? (
            <>
              <span className="h-4 w-px bg-border" />
              {getResolutionLabel(resolution)}
            </>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[420px] rounded-xl p-3 shadow-xl">
        <DropdownMenuLabel>选择比例</DropdownMenuLabel>
        <div className="grid grid-cols-9 gap-1 rounded-xl bg-muted p-2">
          {ratios.slice(compact ? 2 : 0).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs hover:bg-background",
                item.id === ratio && "bg-background shadow-sm"
              )}
            >
              <span
                className="rounded-sm border border-foreground/70"
                style={getRatioIconStyle(item.id)}
              />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        {resolution && onResolutionChange && dimensions ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>选择分辨率</DropdownMenuLabel>
            <div className="grid grid-cols-2 gap-2">
              {resolutionOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onResolutionChange(option.id)}
                  className={cn(
                    "rounded-lg bg-muted px-4 py-2 text-sm font-medium hover:bg-accent",
                    option.id === resolution && "bg-background shadow-sm"
                  )}
                >
                  {option.label}
                  {option.featured ? <Sparkles className="ml-1 inline h-3.5 w-3.5 text-primary" /> : null}
                </button>
              ))}
            </div>
            <DropdownMenuLabel className="mt-2">尺寸</DropdownMenuLabel>
            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
              <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">W</span>
                <span className="float-right font-medium">{dimensions.width}</span>
              </div>
              <span className="text-muted-foreground">↔</span>
              <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">H</span>
                <span className="float-right font-medium">{dimensions.height}</span>
              </div>
              <span className="text-xs text-muted-foreground">PX</span>
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DurationMenu({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="bg-background">
          <Clock className="h-4 w-4" />
          {value}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36 rounded-xl p-2 shadow-xl">
        <DropdownMenuLabel>选择视频生成时长</DropdownMenuLabel>
        {videoDurationOptions.map((option) => (
          <DropdownMenuItem
            key={option}
            onSelect={() => onChange(option)}
            className={cn("rounded-lg", option === value && "bg-accent")}
          >
            <Clock className="h-4 w-4" />
            {option}
            {option === value ? <Check className="ml-auto h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SkillMenu({
  selectedSkill,
  onSelect
}: {
  selectedSkill: string | null;
  onSelect: (skill: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="bg-background">
          <Wand2 className="h-4 w-4" />
          {selectedSkill ?? "使用技能"}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[420px] rounded-xl p-2 shadow-xl">
        <DropdownMenuLabel>选择技能</DropdownMenuLabel>
        {skills.map(([title, description]) => (
          <DropdownMenuItem
            key={title}
            onSelect={() => onSelect(title)}
            className={cn("rounded-lg py-3", title === selectedSkill && "bg-accent")}
          >
            <Wand2 className="h-4 w-4" />
            <span className="min-w-0 flex-1">
              <span className="mr-3 font-medium">{title}</span>
              <span className="text-muted-foreground">{description}</span>
            </span>
            {title === selectedSkill ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MaterialStack({
  materials,
  compact = false,
  onUploadClick,
  onRemove
}: {
  materials: MaterialItem[];
  compact?: boolean;
  onUploadClick: () => void;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (materials.length === 0) {
    return (
      <button
        type="button"
        onClick={onUploadClick}
        className={cn(
          "flex -rotate-6 flex-col items-center justify-center rounded-md bg-muted text-xs text-muted-foreground transition-transform hover:rotate-0 hover:bg-accent",
          compact ? "h-10 w-9 rounded-lg" : "h-[70px] w-[52px]"
        )}
      >
        <Plus className={cn(compact ? "h-4 w-4" : "mb-1 h-5 w-5")} />
        {compact ? null : "参考"}
      </button>
    );
  }
  const visibleMaterials = materials.slice(0, compact ? 3 : 6);
  const cardWidth = compact ? 32 : 52;
  const cardHeight = compact ? 40 : 70;
  const expandedOffset = compact ? 26 : 44;
  const collapsedOffset = compact ? 7 : 9;
  const containerWidth = expanded
    ? Math.min(cardWidth + (visibleMaterials.length - 1) * expandedOffset, compact ? 118 : 284)
    : compact
      ? 62
      : 120;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onUploadClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onUploadClick();
        }
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={cn("relative text-left", compact ? "h-11" : "h-[74px]")}
      style={{ width: containerWidth }}
      aria-label="上传参考素材"
    >
      {visibleMaterials.map((material, index) => {
        const Icon = materialIcon(material.type);
        const offset = expanded ? index * expandedOffset : index * collapsedOffset;
        const style: CSSProperties = {
          transform: `translateX(${offset}px) rotate(${expanded ? 0 : -7 + index * 3}deg)`,
          zIndex: 20 + index
        };
        return (
          <span
            key={material.id}
            className="group/material absolute left-0 top-0 block overflow-visible transition-transform duration-200 ease-out"
            style={style}
            title={material.name}
          >
            <span
              className="relative flex overflow-hidden rounded-md border bg-background shadow-sm"
              style={{ width: cardWidth, height: cardHeight }}
            >
              {material.previewUrl ? (
                <span
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${material.previewUrl})` }}
                />
              ) : (
                <span className="flex h-full w-full flex-col items-center justify-center bg-muted text-[10px] text-muted-foreground">
                  <Icon className="mb-1 h-4 w-4" />
                  {compact ? null : material.type}
                </span>
              )}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(material.id);
                }}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover/material:opacity-100"
                aria-label={`删除 ${material.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
            {material.previewUrl ? (
              <span className="pointer-events-none absolute left-1/2 top-full z-[160] mt-3 hidden w-48 -translate-x-1/2 rounded-xl border bg-background p-2 shadow-2xl group-hover/material:block">
                <span
                  className="block aspect-[4/5] rounded-lg bg-cover bg-center"
                  style={{ backgroundImage: `url(${material.previewUrl})` }}
                />
                <span className="mt-2 block truncate px-1 text-xs text-muted-foreground">{material.name}</span>
              </span>
            ) : null}
          </span>
        );
      })}
      {materials.length > visibleMaterials.length ? (
        <span
          className={cn(
            "absolute z-40 rounded-full bg-foreground px-2 py-0.5 text-xs text-background",
            compact ? "left-8 top-7" : "left-[54px] top-12"
          )}
        >
          +{materials.length - visibleMaterials.length}
        </span>
      ) : null}
    </div>
  );
}

function SubjectPreviewChip({ material }: { material: MaterialItem }) {
  const Icon = materialIcon(material.type);
  return (
    <span className="group/subject relative inline-flex max-w-full items-center gap-2 rounded-full border bg-background/95 px-2 py-1 text-xs shadow-sm">
      <span className="flex h-6 w-6 shrink-0 overflow-hidden rounded-md border bg-muted">
        {material.previewUrl ? (
          <span className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${material.previewUrl})` }} />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </span>
      <span className="min-w-0 truncate">
        <span className="text-primary">{getSubjectToken(material)}</span>
      </span>
      {material.previewUrl ? (
        <span className="pointer-events-none absolute left-0 top-full z-[170] mt-3 hidden w-56 rounded-2xl border bg-popover p-2 shadow-2xl group-hover/subject:block">
          <span
            className="block aspect-[4/5] rounded-xl bg-cover bg-center"
            style={{ backgroundImage: `url(${material.previewUrl})` }}
          />
          <span className="mt-2 block truncate px-1 text-xs text-muted-foreground">{material.name}</span>
        </span>
      ) : null}
    </span>
  );
}

function SourceSlots({ type }: { type: CreationType }) {
  if (type === "video" || type === "motion") {
    return (
      <div className="flex items-center gap-2">
        <span className="flex h-[70px] w-[52px] -rotate-6 flex-col items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
          <Plus className="mb-1 h-4 w-4" />
          首帧
        </span>
        <span className="text-muted-foreground">↔</span>
        <span className="flex h-[70px] w-[52px] rotate-6 flex-col items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
          <Plus className="mb-1 h-4 w-4" />
          尾帧
        </span>
      </div>
    );
  }
  if (type === "avatar") {
    return (
      <div className="flex items-center gap-2">
        <span className="flex h-[70px] w-[52px] -rotate-6 flex-col items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
          <Plus className="mb-1 h-4 w-4" />
          角色
        </span>
        <span className="flex h-[70px] w-[52px] rotate-6 flex-col items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
          <Mic className="mb-1 h-4 w-4" />
          音色
        </span>
      </div>
    );
  }
  return null;
}

function FrameSlot({
  label,
  material,
  onUpload,
  onRemove,
  rotateClassName
}: {
  label: string;
  material?: MaterialItem | null;
  onUpload: () => void;
  onRemove?: (id: string) => void;
  rotateClassName?: string;
}) {
  const Icon = material ? materialIcon(material.type) : Plus;

  if (!material) {
    return (
      <button
        type="button"
        onClick={onUpload}
        className={cn(
          "flex h-[70px] w-[58px] flex-col items-center justify-center rounded-md bg-muted text-xs text-muted-foreground transition-transform hover:rotate-0 hover:bg-accent hover:text-foreground",
          rotateClassName
        )}
      >
        <Plus className="mb-1 h-4 w-4" />
        {label}
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onUpload}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onUpload();
        }
      }}
      className="group/material relative h-[70px] w-[58px] overflow-hidden rounded-md border bg-background shadow-sm"
      title={material.name}
    >
      {material.previewUrl ? (
        <span className="block h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${material.previewUrl})` }} />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center bg-muted text-[10px] text-muted-foreground">
          <Icon className="mb-1 h-4 w-4" />
          {material.type}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-background/85 py-0.5 text-center text-[10px] text-muted-foreground backdrop-blur">
        {label}
      </span>
      {onRemove ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(material.id);
          }}
          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover/material:opacity-100"
          aria-label={`删除 ${material.name}`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function PromptBridge({
  index,
  prompt,
  open,
  onToggle,
  onChange
}: {
  index: number;
  prompt: string;
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex h-[70px] w-[70px] flex-col items-center justify-center rounded-md border bg-background text-xs text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground",
          prompt && "border-primary/50 text-primary"
        )}
      >
        <MessageSquareText className="mb-1 h-4 w-4" />
        {prompt ? "已填提示" : "提示词"}
      </button>
      {open ? (
        <div className="absolute left-0 top-[76px] z-40 w-64 rounded-xl border bg-popover p-3 shadow-xl">
          <label className="mb-2 block text-xs text-muted-foreground">第 {index + 1} 帧到第 {index + 2} 帧</label>
          <Textarea
            value={prompt}
            onChange={(event) => onChange(event.target.value)}
            placeholder="描述两帧之间的动作、镜头或转场"
            className="min-h-[82px] rounded-lg bg-muted px-3 py-2 text-sm"
          />
        </div>
      ) : null}
    </div>
  );
}

function VideoReferenceModeMenu({
  value,
  onChange
}: {
  value: VideoReferenceMode;
  onChange: (value: VideoReferenceMode) => void;
}) {
  const active = videoReferenceModes.find((item) => item.id === value) ?? videoReferenceModes[0]!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="bg-background">
          <SlidersHorizontal className="h-4 w-4" />
          {active.label}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[320px] rounded-xl p-2 shadow-xl">
        <DropdownMenuLabel>参考方式</DropdownMenuLabel>
        {videoReferenceModes.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onSelect={() => onChange(item.id)}
            className={cn("rounded-lg py-3", item.id === value && "bg-accent")}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
            </span>
            {item.id === value ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VideoSourceSlots({
  mode,
  materials,
  firstFrameId,
  lastFrameId,
  multiFrames,
  onUpload,
  onRemove,
  onTogglePrompt,
  onChangePrompt
}: {
  mode: VideoReferenceMode;
  materials: MaterialItem[];
  firstFrameId: string | null;
  lastFrameId: string | null;
  multiFrames: MultiFrameItem[];
  onUpload: (target: UploadTarget) => void;
  onRemove: (id: string) => void;
  onTogglePrompt: (index: number) => void;
  onChangePrompt: (index: number, value: string) => void;
}) {
  const materialById = new Map(materials.map((material) => [material.id, material]));

  if (mode === "reference") {
    return <MaterialStack materials={materials} onUploadClick={() => onUpload({ type: "materials" })} onRemove={onRemove} />;
  }

  if (mode === "firstLast") {
    return (
      <div className="flex items-center gap-2">
        <FrameSlot
          label="首帧"
          material={firstFrameId ? materialById.get(firstFrameId) : null}
          onUpload={() => onUpload({ type: "firstFrame" })}
          onRemove={onRemove}
          rotateClassName="-rotate-6"
        />
        <span className="text-muted-foreground">↔</span>
        <FrameSlot
          label="尾帧"
          material={lastFrameId ? materialById.get(lastFrameId) : null}
          onUpload={() => onUpload({ type: "lastFrame" })}
          onRemove={onRemove}
          rotateClassName="rotate-6"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      {multiFrames.map((frame, index) => (
        <div key={frame.materialId} className="flex items-start gap-2">
          <FrameSlot
            label={`第${index + 1}帧`}
            material={materialById.get(frame.materialId)}
            onUpload={() => onUpload({ type: "multiFrame", index })}
            onRemove={onRemove}
          />
          {index < maxMultiFrames - 1 ? (
            <PromptBridge
              index={index}
              prompt={frame.prompt}
              open={frame.promptOpen}
              onToggle={() => onTogglePrompt(index)}
              onChange={(value) => onChangePrompt(index, value)}
            />
          ) : null}
        </div>
      ))}
      {multiFrames.length < maxMultiFrames ? (
        <FrameSlot label={`第${multiFrames.length + 1}帧`} onUpload={() => onUpload({ type: "multiFrame", index: multiFrames.length })} />
      ) : null}
    </div>
  );
}

function ActionTemplateDialog({
  open,
  selectedTemplateId,
  onOpenChange,
  onSelect
}: {
  open: boolean;
  selectedTemplateId: string | null;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: MotionTemplate) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] p-5">
        <DialogTitle>选择动作模板</DialogTitle>
        <DialogDescription className="mt-1">选择一个模板后，会作为动作参考参与生成。</DialogDescription>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {motionTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                onSelect(template);
                onOpenChange(false);
              }}
              className={cn(
                "group text-left outline-none",
                template.id === selectedTemplateId && "text-primary"
              )}
            >
              <span className="relative block aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
                <span
                  className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105"
                  style={{ backgroundImage: `url(${template.imageUrl})` }}
                />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/45 px-2 py-1 text-xs text-white backdrop-blur">
                  {template.duration}
                  <ArrowUpRightIcon />
                </span>
                {template.id === selectedTemplateId ? (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-4 w-4" />
                  </span>
                ) : null}
              </span>
              <span className="mt-2 block truncate text-sm">{template.title}</span>
              <span className="block truncate text-xs text-muted-foreground">来自{template.author}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArrowUpRightIcon() {
  return <span className="text-sm leading-none">↗</span>;
}

function MotionActionSlot({
  material,
  selectedTemplate,
  onUploadVideo,
  onRemove,
  onSelectTemplate
}: {
  material?: MaterialItem | null;
  selectedTemplate: MotionTemplate | null;
  onUploadVideo: () => void;
  onRemove: (id: string) => void;
  onSelectTemplate: (template: MotionTemplate) => void;
}) {
  const [templateOpen, setTemplateOpen] = useState(false);
  const Icon = material ? materialIcon(material.type) : Wand2;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group/material relative h-[70px] w-[58px] overflow-hidden rounded-md border bg-background text-xs text-muted-foreground shadow-sm transition hover:bg-accent hover:text-foreground"
          >
            {material?.previewUrl ? (
              <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${material.previewUrl})` }} />
            ) : selectedTemplate ? (
              <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${selectedTemplate.imageUrl})` }} />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center bg-muted">
                <Wand2 className="mb-1 h-4 w-4" />
                动作
              </span>
            )}
            {material || selectedTemplate ? (
              <span className="absolute inset-x-0 bottom-0 bg-background/85 py-0.5 text-center text-[10px] text-muted-foreground backdrop-blur">
                {material ? "参考视频" : selectedTemplate?.title}
              </span>
            ) : null}
            {material ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(material.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemove(material.id);
                  }
                }}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover/material:opacity-100"
                aria-label={`删除 ${material.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </span>
            ) : null}
            {material ? <Icon className="absolute left-1 top-1 h-4 w-4 rounded bg-background/80 p-0.5" /> : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 rounded-xl p-2 shadow-xl">
          <DropdownMenuItem className="rounded-lg" onSelect={() => setTemplateOpen(true)}>
            <Clapperboard className="h-4 w-4" />
            选择模板
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-lg" onSelect={onUploadVideo}>
            <Upload className="h-4 w-4" />
            上传参考视频
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ActionTemplateDialog
        open={templateOpen}
        selectedTemplateId={selectedTemplate?.id ?? null}
        onOpenChange={setTemplateOpen}
        onSelect={onSelectTemplate}
      />
    </>
  );
}

function MotionSourceSlots({
  materials,
  roleId,
  actionVideoId,
  selectedTemplate,
  onUploadRole,
  onUploadActionVideo,
  onRemove,
  onSelectTemplate
}: {
  materials: MaterialItem[];
  roleId: string | null;
  actionVideoId: string | null;
  selectedTemplate: MotionTemplate | null;
  onUploadRole: () => void;
  onUploadActionVideo: () => void;
  onRemove: (id: string) => void;
  onSelectTemplate: (template: MotionTemplate) => void;
}) {
  const materialById = new Map(materials.map((material) => [material.id, material]));

  return (
    <div className="flex items-center gap-2">
      <FrameSlot
        label="角色"
        material={roleId ? materialById.get(roleId) : null}
        onUpload={onUploadRole}
        onRemove={onRemove}
        rotateClassName="-rotate-6"
      />
      <MotionActionSlot
        material={actionVideoId ? materialById.get(actionVideoId) : null}
        selectedTemplate={selectedTemplate}
        onUploadVideo={onUploadActionVideo}
        onRemove={onRemove}
        onSelectTemplate={onSelectTemplate}
      />
    </div>
  );
}

function SubjectPicker({
  open,
  materials,
  selectedMaterialId,
  onSelect,
  onClose
}: {
  open: boolean;
  materials: MaterialItem[];
  selectedMaterialId: string | null;
  onSelect: (material: MaterialItem) => void;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute left-0 top-full z-[120] mt-2 w-80 rounded-xl border bg-popover p-2 shadow-2xl">
      <div className="mb-2 flex items-center justify-between px-2 pt-1">
        <span className="text-sm font-medium">选择提示词主体</span>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
          关闭
        </button>
      </div>
      {materials.length === 0 ? (
        <p className="px-2 pb-2 text-sm text-muted-foreground">先上传素材，再用 Shift + @ 选择主体。</p>
      ) : (
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {materials.map((material) => {
            const Icon = materialIcon(material.type);
            return (
              <button
                key={material.id}
                type="button"
                onClick={() => onSelect(material)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent",
                  material.id === selectedMaterialId && "bg-accent"
                )}
              >
                <span className="flex h-10 w-8 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {material.previewUrl ? (
                    <span className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${material.previewUrl})` }} />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{material.name}</span>
                  <span className="block text-xs text-muted-foreground">{getSubjectToken(material)}</span>
                </span>
                {material.id === selectedMaterialId ? <Check className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgentPreferenceMenu({
  agentModel,
  setAgentModel,
  imageModel,
  setImageModel,
  videoModel,
  setVideoModel,
  ratio,
  setRatio,
  resolution,
  setResolution,
  duration,
  setDuration,
  autoMode,
  setAutoMode
}: {
  agentModel: string;
  setAgentModel: (model: string) => void;
  imageModel: string;
  setImageModel: (model: string) => void;
  videoModel: string;
  setVideoModel: (model: string) => void;
  ratio: RatioId;
  setRatio: (ratio: RatioId) => void;
  resolution: ResolutionId;
  setResolution: (resolution: ResolutionId) => void;
  duration: string;
  setDuration: (value: string) => void;
  autoMode: boolean;
  setAutoMode: (enabled: boolean) => void;
}) {
  const [tab, setTab] = useState<"image" | "video">("image");
  const dimensions = getDimensions(ratio, resolution);
  const ratioItems = tab === "video" ? ratios.slice(2) : ratios;
  const tabs = [
    { id: "image" as const, label: "图片", icon: ImagePlus },
    { id: "video" as const, label: "视频", icon: Video }
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="bg-background">
          <SlidersHorizontal className="h-4 w-4" />
          自定义
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[420px] rounded-2xl p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <DropdownMenuLabel className="p-0 text-base font-medium">生成偏好</DropdownMenuLabel>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            自动
            <button
              type="button"
              role="switch"
              aria-checked={autoMode}
              onClick={() => setAutoMode(!autoMode)}
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                autoMode ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform",
                  autoMode ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors",
                  item.id === tab ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <DropdownMenuLabel className="mt-4 px-0">选择比例</DropdownMenuLabel>
        <div className="grid grid-cols-9 gap-1 rounded-xl bg-muted p-2">
          {ratioItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRatio(item.id)}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs hover:bg-background",
                item.id === ratio && "bg-background shadow-sm"
              )}
            >
              <span className="rounded-sm border border-foreground/70" style={getRatioIconStyle(item.id)} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <DropdownMenuLabel className="mt-4 px-0">其他设置</DropdownMenuLabel>
        {tab === "image" ? (
          <div className="space-y-3">
            <select
              value={agentModel}
              onChange={(event) => setAgentModel(event.target.value)}
              className="h-10 w-full rounded-lg bg-muted px-3 text-sm outline-none"
            >
              {agentModels.map(([value]) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={imageModel}
              onChange={(event) => setImageModel(event.target.value)}
              className="h-10 w-full rounded-lg bg-muted px-3 text-sm outline-none"
            >
              {imageModels.map(([value]) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              {resolutionOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setResolution(option.id)}
                  className={cn(
                    "rounded-lg bg-muted px-4 py-2 text-sm font-medium hover:bg-accent",
                    option.id === resolution && "bg-background shadow-sm"
                  )}
                >
                  {option.label}
                  {option.featured ? <Sparkles className="ml-1 inline h-3.5 w-3.5 text-primary" /> : null}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
              <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">W</span>
                <span className="float-right font-medium">{dimensions.width}</span>
              </div>
              <span className="text-muted-foreground">↔</span>
              <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">H</span>
                <span className="float-right font-medium">{dimensions.height}</span>
              </div>
              <span className="text-xs text-muted-foreground">PX</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <select
              value={videoModel}
              onChange={(event) => setVideoModel(event.target.value)}
              className="h-10 rounded-lg bg-muted px-3 text-sm outline-none"
            >
              {videoModels.map(([value]) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="h-10 rounded-lg bg-muted px-3 text-sm outline-none"
            >
              {videoDurationOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VoiceToneDialog({
  open,
  selectedVoiceName,
  onOpenChange,
  onSelect,
  onCloneVoice
}: {
  open: boolean;
  selectedVoiceName: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (voiceName: string) => void;
  onCloneVoice: () => void;
}) {
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const filters = ["性别", "年龄", "语言", "声音特点"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[860px] p-6">
        <DialogTitle className="text-xl">选择音色</DialogTitle>
        <DialogDescription className="sr-only">为数字人选择说话音色，也可以创建克隆音色。</DialogDescription>
        <div className="mt-5 flex gap-8 border-b pb-4 text-sm font-medium">
          <span className="text-foreground">全部音色</span>
          <span className="text-muted-foreground">我的音色</span>
          <span className="text-muted-foreground">收藏</span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              className="flex h-11 items-center justify-between rounded-lg border bg-background px-4 text-sm text-muted-foreground"
            >
              {filter}
              <ChevronDown className="h-4 w-4" />
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-x-8 gap-y-5 md:grid-cols-4">
          <button
            type="button"
            onClick={onCloneVoice}
            className="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-accent"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <Plus className="h-4 w-4" />
            </span>
            上传音色
          </button>
          {voiceTones.map((voice) => {
            const selected = voice.name === selectedVoiceName;
            const previewing = voice.id === previewingVoiceId;
            return (
              <button
                key={voice.id}
                type="button"
                onClick={() => {
                  onSelect(voice.name);
                  onOpenChange(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-2 text-left hover:bg-accent",
                  selected && "bg-accent"
                )}
              >
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreviewingVoiceId((current) => (current === voice.id ? null : voice.id));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      setPreviewingVoiceId((current) => (current === voice.id ? null : voice.id));
                    }
                  }}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted",
                    previewing && "bg-primary text-primary-foreground"
                  )}
                  aria-label={previewing ? `停止试听 ${voice.name}` : `试听 ${voice.name}`}
                >
                  {previewing ? <Volume2 className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm">{voice.name}</span>
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {voice.tags.map((tag) => (
                      <span key={tag} className="rounded bg-cyan-100 px-1 text-[10px] text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-200">
                        {tag}
                      </span>
                    ))}
                  </span>
                </span>
                {selected ? <Check className="ml-auto h-4 w-4 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FunctionControls({
  creationType,
  agentModel,
  setAgentModel,
  imageModel,
  setImageModel,
  videoModel,
  setVideoModel,
  videoReferenceMode,
  setVideoReferenceMode,
  avatarMode,
  setAvatarMode,
  ratio,
  setRatio,
  resolution,
  setResolution,
  duration,
  setDuration,
  agentAuto,
  setAgentAuto,
  clonedVoiceName,
  selectedVoiceName,
  setSelectedVoiceName,
  motionMode,
  setMotionMode,
  selectedSkill,
  onSkillSelect,
  onCloneVoiceUpload,
  onOpenSubjectPicker
}: {
  creationType: CreationType;
  agentModel: string;
  setAgentModel: (model: string) => void;
  imageModel: string;
  setImageModel: (model: string) => void;
  videoModel: string;
  setVideoModel: (model: string) => void;
  videoReferenceMode: VideoReferenceMode;
  setVideoReferenceMode: (mode: VideoReferenceMode) => void;
  avatarMode: string;
  setAvatarMode: (model: string) => void;
  ratio: RatioId;
  setRatio: (ratio: RatioId) => void;
  resolution: ResolutionId;
  setResolution: (resolution: ResolutionId) => void;
  duration: string;
  setDuration: (value: string) => void;
  agentAuto: boolean;
  setAgentAuto: (enabled: boolean) => void;
  clonedVoiceName: string | null;
  selectedVoiceName: string;
  setSelectedVoiceName: (voiceName: string) => void;
  motionMode: string;
  setMotionMode: (model: string) => void;
  selectedSkill: string | null;
  onSkillSelect: (skill: string) => void;
  onCloneVoiceUpload: () => void;
  onOpenSubjectPicker: () => void;
}) {
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);

  if (creationType === "image") {
    return (
      <>
        <SelectMenu icon={Box} label="选择模型" items={imageModels} active={imageModel} onChange={setImageModel} />
        <RatioMenu ratio={ratio} onChange={setRatio} resolution={resolution} onResolutionChange={setResolution} />
      </>
    );
  }
  if (creationType === "video") {
    return (
      <>
        <SelectMenu icon={Box} label="选择模型" items={videoModels} active={videoModel} onChange={setVideoModel} />
        <VideoReferenceModeMenu value={videoReferenceMode} onChange={setVideoReferenceMode} />
        <RatioMenu ratio={ratio} onChange={setRatio} compact />
        <DurationMenu value={duration} onChange={setDuration} />
      </>
    );
  }
  if (creationType === "motion") {
    return (
      <SelectMenu icon={Box} label="选择模型" items={motionModes} active={motionMode} onChange={setMotionMode} />
    );
  }
  if (creationType === "avatar") {
    return (
      <>
        <SelectMenu icon={Box} label="选择模型" items={avatarModes} active={avatarMode} onChange={setAvatarMode} />
        <Button type="button" variant="outline" size="sm" className="bg-background" onClick={() => setVoiceDialogOpen(true)}>
          <Volume2 className="h-4 w-4" />
          音色上传
        </Button>
        <VoiceToneDialog
          open={voiceDialogOpen}
          selectedVoiceName={selectedVoiceName}
          onOpenChange={setVoiceDialogOpen}
          onSelect={setSelectedVoiceName}
          onCloneVoice={onCloneVoiceUpload}
        />
      </>
    );
  }
  if (creationType === "voice") {
    return (
      <Button type="button" variant="outline" size="sm" className="bg-background" onClick={onCloneVoiceUpload}>
        <Upload className="h-4 w-4" />
        {clonedVoiceName ? `已克隆：${clonedVoiceName}` : "克隆声音"}
      </Button>
    );
  }
  return (
    <>
      <AgentPreferenceMenu
        agentModel={agentModel}
        setAgentModel={setAgentModel}
        imageModel={imageModel}
        setImageModel={setImageModel}
        videoModel={videoModel}
        setVideoModel={setVideoModel}
        ratio={ratio}
        setRatio={setRatio}
        resolution={resolution}
        setResolution={setResolution}
        duration={duration}
        setDuration={setDuration}
        autoMode={agentAuto}
        setAutoMode={setAgentAuto}
      />
      <SkillMenu selectedSkill={selectedSkill} onSelect={onSkillSelect} />
      <Button type="button" variant="outline" size="sm" className="bg-background" onClick={onOpenSubjectPicker}>
        <AtSign className="h-4 w-4" />
      </Button>
    </>
  );
}

function SourceMaterialPreview({ material }: { material: JobMaterialSnapshot }) {
  if (material.previewUrl) {
    return (
      <span
        className="block h-10 w-10 overflow-hidden rounded-md border border-white/10 bg-cover bg-center shadow-sm"
        style={{ backgroundImage: `url(${material.previewUrl})` }}
        title={material.name}
      />
    );
  }

  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
      {material.type === "video" ? (
        <FileVideo className="h-4 w-4" />
      ) : material.type === "audio" ? (
        <FileAudio className="h-4 w-4" />
      ) : (
        <FileImage className="h-4 w-4" />
      )}
    </span>
  );
}

function ResultPlaceholder({ job, index = 0 }: { job: GenerationJob; index?: number }) {
  const isVideo = isVideoCreationType(job.type);
  const loading = job.status !== "completed" && job.status !== "failed";

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-[#dfeff8]", loading && "generation-loading-card")}>
      <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(135deg,#f7f7f7,#d8ebe5_48%,#b9d5ff)]">
        {loading ? (
          <>
            <div className="generation-loading-glow generation-loading-glow-a" />
            <div className="generation-loading-glow generation-loading-glow-b" />
            <div className="generation-loading-sheen" />
          </>
        ) : null}
        <div className="absolute inset-0 opacity-65">
          <div className="absolute left-[9%] top-[14%] h-[44%] w-[30%] rounded-full border border-white/50" />
          <div className="absolute bottom-[13%] left-[16%] h-[20%] w-[68%] rounded-t-full bg-white/20" />
          <div className="absolute right-[12%] top-[18%] h-[44%] w-[28%] rounded-lg border border-white/60 bg-white/10" />
        </div>
        {isVideo ? (
          <div className="absolute inset-x-4 bottom-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background/80">
              <Play className="h-3.5 w-3.5" />
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/40">
              <span className="block h-full bg-primary" style={{ width: `${Math.min(job.progress, submittedProgressLimit)}%` }} />
            </span>
          </div>
        ) : (
          <div className="absolute bottom-3 right-3 rounded bg-background/70 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur">
            #{index + 1}
          </div>
        )}
      </div>
    </div>
  );
}

function GeneratedImageFrame({ job, index, outputUrl }: { job: GenerationJob; index: number; outputUrl: string }) {
  const [loaded, setLoaded] = useState(false);
  const isPersistedCompletedOutput = job.status === "completed";
  const showLoadingPlaceholder = !isPersistedCompletedOutput && !loaded;

  useEffect(() => {
    setLoaded(false);
  }, [outputUrl]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#e9f7ff]">
      <div className={cn("absolute inset-0 transition-opacity duration-200", showLoadingPlaceholder ? "opacity-100" : "opacity-0")}>
        <ResultPlaceholder job={job} index={index} />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={outputUrl}
        alt={`${job.prompt} 生成结果 ${index + 1}`}
        className={cn(
          "relative z-10 h-full w-full object-cover transition-opacity duration-200",
          loaded || isPersistedCompletedOutput ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setLoaded(true)}
      />
      {showLoadingPlaceholder ? (
        <span className="absolute left-3 top-3 z-20 rounded-md bg-slate-900/10 px-2.5 py-1 text-xs font-semibold text-slate-900 backdrop-blur">
          加载中
        </span>
      ) : null}
    </div>
  );
}

function ResultFrame({ job, index = 0 }: { job: GenerationJob; index?: number }) {
  const isVideo = isVideoCreationType(job.type);
  const isAudio = job.type === "voice";
  const outputUrl = getOutputUrl(job, index);
  if (job.error) {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden bg-destructive/10 p-4 text-xs leading-5 text-destructive">
        {job.error}
      </div>
    );
  }
  if (outputUrl && isVideo) {
    return <video className="h-full w-full bg-black object-contain" controls src={outputUrl} />;
  }
  if (outputUrl) {
    return <GeneratedImageFrame job={job} index={index} outputUrl={outputUrl} />;
  }
  if (job.resultText && (job.type === "agent" || job.status === "completed")) {
    return (
      <div className="h-full w-full overflow-y-auto bg-card/80 p-5 text-sm leading-6 text-foreground">
        {job.resultText}
      </div>
    );
  }
  if (isAudio) {
    return (
      <div className="relative flex h-full w-full flex-col justify-center bg-card/70 p-5">
        {job.resultText ? (
          <p className="mb-4 line-clamp-4 text-sm leading-6 text-muted-foreground">{job.resultText}</p>
        ) : null}
        <div className="flex items-center gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Play className="h-5 w-5" />
          </span>
          <div className="flex h-16 flex-1 items-center gap-1 overflow-hidden">
            {Array.from({ length: 42 }, (_, index) => (
              <span
                key={index}
                className={cn("w-1 rounded-full", index * 2 < job.progress ? "bg-primary" : "bg-muted")}
                style={{ height: 10 + ((index * 13) % 42) }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
  return <ResultPlaceholder job={job} index={index} />;
}

function DetailInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-100 py-3 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-zinc-950">{value}</span>
    </div>
  );
}

function DetailActionButton({
  icon: Icon,
  label,
  onClick,
  destructive = false
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition",
        destructive
          ? "text-red-600 hover:bg-red-50"
          : "bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ResultDetailDialog({
  job,
  index,
  open,
  onOpenChange,
  onDeleteOutput,
  onFavorite,
  onPublish
}: {
  job: GenerationJob | null;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteOutput: (job: GenerationJob, index: number) => void;
  onFavorite: (job: GenerationJob) => void;
  onPublish: (job: GenerationJob) => void;
}) {
  const outputUrl = job ? getOutputUrl(job, index) : null;
  const resolution = job?.resolution ?? "2K";
  const dimensions = job ? getDimensions(job.ratio, resolution) : null;
  const isVideo = job ? isVideoCreationType(job.type) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[calc(100vh-24px)] max-h-none w-[calc(100vw-24px)] max-w-none overflow-hidden border-zinc-200 bg-white p-0 text-zinc-950">
        <DialogTitle className="sr-only">生成内容预览</DialogTitle>
        <DialogDescription className="sr-only">查看生成内容、提示词和生成参数。</DialogDescription>
        {job ? (
          <div className="flex h-full min-h-0 flex-col bg-white md:flex-row">
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-zinc-50">
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-zinc-50">
                {outputUrl && isVideo ? (
                  <video className="h-full w-full object-contain" src={outputUrl} controls autoPlay />
                ) : outputUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={outputUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl"
                      aria-hidden="true"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={outputUrl}
                      alt={`${job.prompt} 生成结果 ${index + 1}`}
                      className="relative z-10 h-full max-h-full w-auto max-w-full object-contain"
                    />
                  </>
                ) : (
                  <div className="h-full w-full">
                    <ResultFrame job={job} index={index} />
                  </div>
                )}
              </div>
            </div>
            <aside className="flex max-h-full w-full shrink-0 flex-col border-t border-zinc-200 bg-white p-5 md:w-[380px] md:border-l md:border-t-0 md:p-8">
              <div className="mb-6 grid grid-cols-2 gap-2">
                <DetailActionButton
                  icon={Download}
                  label="下载"
                  onClick={() => void downloadGeneratedOutput(job, index)}
                />
                <DetailActionButton icon={Star} label="收藏" onClick={() => onFavorite(job)} />
                <DetailActionButton icon={Upload} label="发布" onClick={() => onPublish(singleOutputJob(job, index))} />
                <DetailActionButton
                  icon={Trash2}
                  label="删除"
                  destructive
                  onClick={() => {
                    onDeleteOutput(job, index);
                    onOpenChange(false);
                  }}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="mb-7">
                  <p className="mb-2 text-xs font-medium text-zinc-500">
                    {isVideo ? "视频提示词" : "图片提示词"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-950">{job.prompt}</p>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-500">生成信息</p>
                  <DetailInfoRow label="模型" value={job.model} />
                  <DetailInfoRow label="比例" value={job.ratio} />
                  <DetailInfoRow label="分辨率" value={`${getResolutionLabel(resolution)} · ${dimensions?.width ?? "-"} x ${dimensions?.height ?? "-"}`} />
                  <DetailInfoRow label="数量/时长" value={job.type === "image" ? `${job.outputCount || 1} 张` : job.duration} />
                  <DetailInfoRow label="消耗" value={`${formatCredits(job.cost)} 积分`} />
                  <DetailInfoRow label="生成时间" value={job.createdAt} />
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ResultImageActions({
  job,
  index,
  onCanvasEdit,
  onDelete,
  onPublish,
  onReport
}: {
  job: GenerationJob;
  index: number;
  onCanvasEdit?: (job: GenerationJob) => void;
  onDelete: (job: GenerationJob, index: number) => void;
  onPublish: (job: GenerationJob) => void;
  onReport: (job: GenerationJob) => void;
}) {
  const outputUrl = getOutputUrl(job, index);
  const scopedJob = singleOutputJob(job, index);

  return (
    <div
      className="absolute right-2 top-2 z-30 flex items-center rounded-xl bg-zinc-950/82 p-1 text-white opacity-0 shadow-2xl shadow-black/30 backdrop-blur-md transition-opacity duration-150 group-hover/result:opacity-100 group-focus-within/result:opacity-100"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={!outputUrl}
        onClick={() => void downloadGeneratedOutput(job, index)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
        aria-label="下载"
        title="下载"
      >
        <Download className="h-4 w-4" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition hover:bg-white/15"
            aria-label="更多"
            title="更多"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-44 rounded-xl border-white/70 bg-white p-2 text-zinc-950 shadow-2xl"
        >
          <DropdownMenuItem className="rounded-lg focus:bg-zinc-100" onSelect={() => onPublish(scopedJob)}>
            <Upload className="h-4 w-4" />
            发布
          </DropdownMenuItem>
          <DropdownMenuItem
            className="rounded-lg focus:bg-zinc-100"
            onSelect={() => onCanvasEdit?.(scopedJob)}
          >
            <SquarePen className="h-4 w-4" />
            去画布编辑
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-lg focus:bg-zinc-100" onSelect={() => onDelete(job, index)}>
            <Trash2 className="h-4 w-4" />
            删除
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-lg focus:bg-zinc-100" onSelect={() => onReport(scopedJob)}>
            <Flag className="h-4 w-4" />
            举报
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function getCardProgressLabel(job: GenerationJob): string | null {
  if (job.status === "failed" || job.status === "completed") {
    return null;
  }
  if (job.status === "submitted") {
    return `${Math.min(job.progress, submittedProgressLimit)}%处理中`;
  }
  return `${Math.min(job.progress, runningProgressLimit)}%渲染中`;
}

function ResultImageCard({
  job,
  index,
  ratio,
  onCanvasEdit,
  onDelete,
  onOpenDetail,
  onPublish,
  onReport
}: {
  job: GenerationJob;
  index: number;
  ratio: ReturnType<typeof getRatio>;
  onCanvasEdit?: (job: GenerationJob) => void;
  onDelete: (job: GenerationJob, index: number) => void;
  onOpenDetail: (job: GenerationJob, index: number) => void;
  onPublish: (job: GenerationJob) => void;
  onReport: (job: GenerationJob) => void;
}) {
  const progressLabel = getCardProgressLabel(job);
  const canOpenDetail = Boolean(getOutputUrl(job, index) || job.resultText);

  return (
    <div
      className={cn(
        "group/result relative min-w-0 overflow-hidden rounded-[4px] bg-[#e9f7ff] shadow-sm outline-none ring-1 ring-black/5",
        canOpenDetail && "cursor-zoom-in"
      )}
      style={{ aspectRatio: ratio.aspect }}
      tabIndex={0}
      role={canOpenDetail ? "button" : undefined}
      onClick={() => {
        if (canOpenDetail) {
          onOpenDetail(job, index);
        }
      }}
      onKeyDown={(event) => {
        if (canOpenDetail && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpenDetail(job, index);
        }
      }}
    >
      {progressLabel ? (
        <span className="absolute left-3 top-3 z-20 rounded-md bg-slate-900/10 px-2.5 py-1 text-xs font-semibold text-slate-900 backdrop-blur">
          {progressLabel}
        </span>
      ) : null}
      <ResultFrame job={job} index={index} />
      <ResultImageActions
        job={job}
        index={index}
        onCanvasEdit={onCanvasEdit}
        onDelete={onDelete}
        onPublish={onPublish}
        onReport={onReport}
      />
    </div>
  );
}

function ResultBatchFrame({
  job,
  onCanvasEdit,
  onDeleteOutput,
  onOpenDetail,
  onPublish,
  onReport
}: {
  job: GenerationJob;
  onCanvasEdit?: (job: GenerationJob) => void;
  onDeleteOutput: (job: GenerationJob, index: number) => void;
  onOpenDetail: (job: GenerationJob, index: number) => void;
  onPublish: (job: GenerationJob) => void;
  onReport: (job: GenerationJob) => void;
}) {
  const ratio = getRatio(job.ratio);
  const outputCount = getVisibleOutputCount(job);
  const isImage = job.type === "image";

  if (isImage) {
    return (
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4" style={{ maxWidth: resultStageMaxWidth }}>
        {Array.from({ length: outputCount }, (_, index) => (
          <ResultImageCard
            key={`${job.id}-${index}`}
            job={job}
            index={index}
            ratio={ratio}
            onCanvasEdit={onCanvasEdit}
            onDelete={onDeleteOutput}
            onOpenDetail={onOpenDetail}
            onPublish={onPublish}
            onReport={onReport}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-1" style={{ maxWidth: videoResultCardWidth }}>
      <ResultImageCard
        job={job}
        index={0}
        ratio={ratio}
        onCanvasEdit={onCanvasEdit}
        onDelete={onDeleteOutput}
        onOpenDetail={onOpenDetail}
        onPublish={onPublish}
        onReport={onReport}
      />
    </div>
  );
}

function GenerationBoard({
  jobs,
  onEdit,
  onRegenerate,
  onDelete,
  onDeleteOutput,
  onOpenCanvasEdit,
  onOpenDetail,
  onPublish,
  onReport
}: {
  jobs: GenerationJob[];
  onEdit: (job: GenerationJob) => void;
  onRegenerate: (job: GenerationJob) => void;
  onDelete: (job: GenerationJob) => void;
  onDeleteOutput: (job: GenerationJob, index: number) => void;
  onOpenCanvasEdit?: (job: GenerationJob) => void;
  onOpenDetail: (job: GenerationJob, index: number) => void;
  onPublish: (job: GenerationJob) => void;
  onReport: (job: GenerationJob) => void;
}) {
  return (
    <div className="w-full">
      <div className="mx-auto flex max-w-[1140px] flex-col gap-10">
        {jobs.map((job) => (
          <article key={job.id} className="w-full min-w-0">
            <div className="mb-3 flex items-start gap-3">
              {job.sourceMaterials.length > 0 ? (
                <div className="flex shrink-0 -space-x-2 pt-0.5">
                  {job.sourceMaterials.slice(0, 3).map((material) => (
                    <SourceMaterialPreview key={material.id} material={material} />
                  ))}
                </div>
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <MessageSquareText className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-6 text-foreground">
                  {job.prompt}
                  <span className="ml-2 whitespace-nowrap text-muted-foreground">
                    {job.model} | {job.ratio} | {job.type === "image" ? `${job.outputCount || 1} 张` : job.duration}
                  </span>
                </p>
              </div>
            </div>
            <ResultBatchFrame
              job={job}
              onCanvasEdit={onOpenCanvasEdit}
              onDeleteOutput={onDeleteOutput}
              onOpenDetail={onOpenDetail}
              onPublish={onPublish}
              onReport={onReport}
            />
            <div className="mt-2 flex items-center gap-1.5">
              <Button type="button" variant="secondary" size="sm" onClick={() => onEdit(job)}>
                <SquarePen className="h-3.5 w-3.5" />
                重新编辑
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => onRegenerate(job)}>
                <RefreshCcw className="h-3.5 w-3.5" />
                再次生成
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="secondary" size="icon-sm" aria-label="更多结果操作">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onDelete(job)}>
                    <Trash2 className="h-4 w-4" />
                    删除该批次结果
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                {job.status === "failed"
                  ? "失败"
                  : job.status === "submitted"
                    ? "处理中"
                    : job.status === "completed"
                      ? "已完成"
                      : "生成中"}
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {job.createdAt} · 消耗 {formatCredits(job.cost)} 积分
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

interface GenerationComposerProps {
  canvasMode?: boolean;
  className?: string;
  defaultCreationType?: CreationType;
  expanded?: boolean;
  helperClassName?: string;
  hideHelper?: boolean;
  onFocusWithin?: () => void;
  onCreationTypeChange?: (type: CreationType) => void;
  onGenerate?: (job: GenerationJob) => void;
  onGenerationUpdate?: (jobId: string, patch: Partial<GenerationJob>) => void;
  panelClassName?: string;
  draftRequest?: GenerationDraftRequest | null;
  selectedCreationType?: CreationType;
}

export function GenerationComposer({
  canvasMode = false,
  className,
  defaultCreationType = "agent",
  expanded = true,
  helperClassName,
  hideHelper = false,
  onFocusWithin,
  onCreationTypeChange,
  onGenerate,
  onGenerationUpdate,
  panelClassName,
  draftRequest,
  selectedCreationType
}: GenerationComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const materialsRef = useRef<MaterialItem[]>([]);
  const uploadTargetRef = useRef<UploadTarget>({ type: "materials" });
  const [uploadAccept, setUploadAccept] = useState("");
  const [localCreationType, setLocalCreationType] = useState<CreationType>(defaultCreationType);
  const [prompt, setPrompt] = useState("");
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [ratio, setRatio] = useState<RatioId>("16:9");
  const [resolution, setResolution] = useState<ResolutionId>("2K");
  const [duration, setDuration] = useState("5s");
  const [imageModel, setImageModel] = useState("Doubao-Seedream-5.0-lite");
  const [videoModel, setVideoModel] = useState("Seedance 1.0 Fast");
  const [videoReferenceMode, setVideoReferenceMode] = useState<VideoReferenceMode>("reference");
  const [avatarMode, setAvatarMode] = useState("快速模式");
  const [motionMode, setMotionMode] = useState("生动");
  const [selectedVoiceName, setSelectedVoiceName] = useState("甜爽女大");
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
  const [agentAuto, setAgentAuto] = useState(true);
  const [agentModel, setAgentModel] = useState("Doubao-Seed-2.0-lite");
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [firstFrameId, setFirstFrameId] = useState<string | null>(null);
  const [lastFrameId, setLastFrameId] = useState<string | null>(null);
  const [motionRoleId, setMotionRoleId] = useState<string | null>(null);
  const [motionActionVideoId, setMotionActionVideoId] = useState<string | null>(null);
  const [motionTemplate, setMotionTemplate] = useState<MotionTemplate | null>(null);
  const [multiFrames, setMultiFrames] = useState<MultiFrameItem[]>([]);
  const creationType = selectedCreationType ?? localCreationType;
  const activeType = creationTypes.find((item) => item.id === creationType) ?? creationTypes[0]!;
  const collapsed = canvasMode && !expanded;
  const selectedSubject = selectedSubjectId ? materials.find((item) => item.id === selectedSubjectId) ?? null : null;
  const canSelectSubject = creationType === "agent" || creationType === "image" || creationType === "video";
  const spendCredits = useChatStore((state) => state.spendCredits);
  const addCredits = useChatStore((state) => state.addCredits);
  const outputCount = creationType === "image" ? defaultImageOutputCount : 1;
  const generationCost = useMemo(
    () =>
      calculateGenerationCost({
        type: creationType,
        duration,
        outputCount,
        resolution,
        materialsCount: materials.length
      }),
    [creationType, duration, materials.length, outputCount, resolution]
  );

  useEffect(() => {
    materialsRef.current = materials;
  }, [materials]);

  useEffect(() => {
    if (!draftRequest) {
      return;
    }
    if (selectedCreationType === undefined) {
      setLocalCreationType(draftRequest.type);
    }
    onCreationTypeChange?.(draftRequest.type);
    setPrompt(draftRequest.prompt);
    setRatio(draftRequest.ratio);
  }, [draftRequest, onCreationTypeChange, selectedCreationType]);

  useEffect(() => {
    return () => {
      materialsRef.current.forEach((material) => {
        if (material.previewUrl) {
          URL.revokeObjectURL(material.previewUrl);
        }
      });
    };
  }, []);

  function changeCreationType(type: CreationType): void {
    if (selectedCreationType === undefined) {
      setLocalCreationType(type);
    }
    onCreationTypeChange?.(type);
  }

  function getAcceptForTarget(target: UploadTarget): string {
    if (target.type === "voiceClone") {
      return "audio/*";
    }
    if (target.type === "motionRole") {
      return "image/*";
    }
    if (target.type === "motionActionVideo") {
      return "video/*";
    }
    if (target.type === "firstFrame" || target.type === "lastFrame" || target.type === "multiFrame") {
      return "image/*,video/*";
    }
    return "";
  }

  function openUpload(target: UploadTarget = { type: "materials" }): void {
    uploadTargetRef.current = target;
    const nextAccept = getAcceptForTarget(target);
    setUploadAccept(nextAccept);
    if (fileInputRef.current) {
      fileInputRef.current.accept = nextAccept;
    }
    fileInputRef.current?.click();
  }

  function removeMaterial(id: string): void {
    const removedMaterial = materials.find((material) => material.id === id);
    if (removedMaterial?.previewUrl) {
      URL.revokeObjectURL(removedMaterial.previewUrl);
    }

    setMaterials((current) => current.filter((material) => material.id !== id));
    setFirstFrameId((current) => (current === id ? null : current));
    setLastFrameId((current) => (current === id ? null : current));
    setClonedVoiceId((current) => (current === id ? null : current));
    setMotionRoleId((current) => (current === id ? null : current));
    setMotionActionVideoId((current) => (current === id ? null : current));
    setMultiFrames((current) => current.filter((frame) => frame.materialId !== id));

    if (removedMaterial && selectedSubjectId === id) {
      setPrompt((current) =>
        current
          .replace(new RegExp(`(^|\\s)${escapeRegExp(`@「${removedMaterial.name}」`)}(?=\\s|$)\\s*`), "$1")
          .replace(new RegExp(`(^|\\s)${escapeRegExp(getSubjectToken(removedMaterial))}(?=\\s|$)\\s*`), "$1")
          .trimStart()
      );
      setSelectedSubjectId(null);
    }
  }

  function uploadFiles(files: FileList | null): void {
    if (!files?.length) {
      return;
    }
    const target = uploadTargetRef.current;
    const nextItems = Array.from(files).map((file) => {
      const type = getMaterialType(file);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        type,
        previewUrl: type === "image" ? URL.createObjectURL(file) : null,
        file
      };
    });
    setMaterials((current) => [...current, ...nextItems].slice(0, 24));

    if (target.type === "firstFrame") {
      setFirstFrameId(nextItems[0]?.id ?? null);
    } else if (target.type === "lastFrame") {
      setLastFrameId(nextItems[0]?.id ?? null);
    } else if (target.type === "voiceClone") {
      setClonedVoiceId(nextItems[0]?.id ?? null);
    } else if (target.type === "motionRole") {
      setMotionRoleId(nextItems[0]?.id ?? null);
    } else if (target.type === "motionActionVideo") {
      setMotionActionVideoId(nextItems[0]?.id ?? null);
      setMotionTemplate(null);
    } else if (target.type === "multiFrame") {
      setMultiFrames((current) => {
        const next = [...current];
        nextItems.slice(0, maxMultiFrames - target.index).forEach((item, offset) => {
          const existing = next[target.index + offset];
          next[target.index + offset] = {
            materialId: item.id,
            prompt: existing?.prompt ?? "",
            promptOpen: existing?.promptOpen ?? false
          };
        });
        return next.slice(0, maxMultiFrames).filter((frame): frame is MultiFrameItem => Boolean(frame));
      });
    }

    uploadTargetRef.current = { type: "materials" };
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function selectSkill(skill: string): void {
    setPrompt((current) => {
      const currentWithoutSkill = selectedSkill
        ? current.replace(new RegExp(`^${escapeRegExp(getSkillToken(selectedSkill))}\\s*`), "")
        : current;
      return `${getSkillToken(skill)} ${currentWithoutSkill.trimStart()}`.trimEnd();
    });
    setSelectedSkill(skill);
  }

  function selectSubject(material: MaterialItem): void {
    const previousMaterial = selectedSubjectId ? materials.find((item) => item.id === selectedSubjectId) : null;
    setPrompt((current) => {
      let next = current;
      if (previousMaterial) {
        next = next
          .replace(new RegExp(`(^|\\s)${escapeRegExp(`@「${previousMaterial.name}」`)}(?=\\s|$)\\s*`), "$1")
          .replace(new RegExp(`(^|\\s)${escapeRegExp(getSubjectToken(previousMaterial))}(?=\\s|$)\\s*`), "$1")
          .trimStart();
      }
      return next.trimStart();
    });
    setSelectedSubjectId(material.id);
    setSubjectPickerOpen(false);
  }

  function toggleFramePrompt(index: number): void {
    setMultiFrames((current) =>
      current.map((frame, frameIndex) =>
        frameIndex === index ? { ...frame, promptOpen: !frame.promptOpen } : frame
      )
    );
  }

  function changeFramePrompt(index: number, value: string): void {
    setMultiFrames((current) =>
      current.map((frame, frameIndex) => (frameIndex === index ? { ...frame, prompt: value } : frame))
    );
  }

  function submitGeneration(): void {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return;
    }
    if (!spendCredits(generationCost, activeType.label)) {
      return;
    }
    const model =
      creationType === "image"
        ? imageModel
        : creationType === "video" || creationType === "motion"
          ? creationType === "motion"
            ? videoModel
            : videoModel
          : creationType === "avatar"
            ? videoModel
            : creationType === "voice"
              ? "Doubao-Seed-2.0-mini"
              : agentModel;
    const job: GenerationJob = {
      id: crypto.randomUUID(),
      type: creationType,
      prompt: trimmed,
      ratio,
      progress: 1,
      model,
      duration,
      resolution,
      createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      outputCount,
      sourceMaterials: materials.map((material) => ({
        id: material.id,
        name: material.name,
        type: material.type,
        previewUrl: material.previewUrl
      })),
      cost: generationCost,
      status: "running"
    };
    const files = materials.map((material) => material.file).filter((file): file is File => Boolean(file));
    onGenerate?.(job);
    void requestGenerationResult(job, files, resolution)
      .then((result) => {
        onGenerationUpdate?.(job.id, generationResultToPatch(job, result));
        continueSubmittedGeneration(job, result, onGenerationUpdate);
      })
      .catch((error) => {
        addCredits(generationCost, "生成失败退回");
        onGenerationUpdate?.(job.id, {
          progress: 100,
          status: "failed",
          error: error instanceof Error ? error.message : "Generation failed."
        });
      });
    setPrompt("");
    setSelectedSkill(null);
    setSelectedSubjectId(null);
    setSubjectPickerOpen(false);
    window.requestAnimationFrame(() => {
      promptTextareaRef.current?.focus();
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "@" && event.shiftKey && canSelectSubject) {
      event.preventDefault();
      setSubjectPickerOpen(true);
      return;
    }
    if (event.key === "Escape" && subjectPickerOpen) {
      event.preventDefault();
      setSubjectPickerOpen(false);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitGeneration();
    }
  }

  const showStandaloneSubjectButton = canSelectSubject && creationType !== "agent";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitGeneration();
      }}
      onClick={(event) => {
        if (onFocusWithin) {
          event.stopPropagation();
          onFocusWithin();
        }
      }}
      onFocusCapture={onFocusWithin}
      className={cn("relative z-40 w-full max-w-[920px] transition-all duration-300", className)}
    >
      <div
        className={cn(
          "rounded-2xl border bg-card p-3 shadow-lg shadow-black/5 transition-all duration-300",
          collapsed && "rounded-[24px] px-3 py-2",
          panelClassName
        )}
      >
        <div className={cn("flex gap-3", collapsed && "items-center gap-2")}>
          <div className="shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={uploadAccept}
              className="hidden"
              onChange={(event) => uploadFiles(event.target.files)}
            />
            {creationType === "motion" ? (
              <MotionSourceSlots
                materials={materials}
                roleId={motionRoleId}
                actionVideoId={motionActionVideoId}
                selectedTemplate={motionTemplate}
                onUploadRole={() => openUpload({ type: "motionRole" })}
                onUploadActionVideo={() => openUpload({ type: "motionActionVideo" })}
                onRemove={removeMaterial}
                onSelectTemplate={setMotionTemplate}
              />
            ) : creationType === "video" ? (
              <VideoSourceSlots
                mode={videoReferenceMode}
                materials={materials}
                firstFrameId={firstFrameId}
                lastFrameId={lastFrameId}
                multiFrames={multiFrames}
                onUpload={openUpload}
                onRemove={removeMaterial}
                onTogglePrompt={toggleFramePrompt}
                onChangePrompt={changeFramePrompt}
              />
            ) : creationType === "agent" || creationType === "image" || creationType === "voice" ? (
              <MaterialStack
                materials={materials}
                compact={collapsed}
                onUploadClick={() => openUpload({ type: "materials" })}
                onRemove={removeMaterial}
              />
            ) : (
              <div
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => openUpload({ type: "materials" })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openUpload({ type: "materials" });
                  }
                }}
              >
                <SourceSlots type={creationType} />
              </div>
            )}
          </div>
          <div className="relative flex-1">
            {selectedSubject && !collapsed ? (
              <div className="mb-2">
                <SubjectPreviewChip material={selectedSubject} />
              </div>
            ) : null}
            <Textarea
              ref={promptTextareaRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholders[creationType]}
              rows={collapsed ? 1 : undefined}
              className={cn(
                "min-h-[92px] px-1 py-1 text-sm leading-7",
                collapsed && "h-10 min-h-10 max-h-10 overflow-hidden py-2 leading-6"
              )}
            />
            <SubjectPicker
              open={subjectPickerOpen}
              materials={materials}
              selectedMaterialId={selectedSubjectId}
              onSelect={selectSubject}
              onClose={() => setSubjectPickerOpen(false)}
            />
          </div>
        </div>

        {!collapsed ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <TypeDropdown creationType={creationType} onChange={changeCreationType} />
          <FunctionControls
            creationType={creationType}
            agentModel={agentModel}
            setAgentModel={setAgentModel}
            imageModel={imageModel}
            setImageModel={setImageModel}
            videoModel={videoModel}
            setVideoModel={setVideoModel}
            videoReferenceMode={videoReferenceMode}
            setVideoReferenceMode={setVideoReferenceMode}
            avatarMode={avatarMode}
            setAvatarMode={setAvatarMode}
            ratio={ratio}
            setRatio={setRatio}
            resolution={resolution}
            setResolution={setResolution}
            duration={duration}
            setDuration={setDuration}
            agentAuto={agentAuto}
            setAgentAuto={setAgentAuto}
            clonedVoiceName={clonedVoiceId ? materials.find((material) => material.id === clonedVoiceId)?.name ?? null : null}
            selectedVoiceName={selectedVoiceName}
            setSelectedVoiceName={setSelectedVoiceName}
            motionMode={motionMode}
            setMotionMode={setMotionMode}
            selectedSkill={selectedSkill}
            onSkillSelect={selectSkill}
            onCloneVoiceUpload={() => openUpload({ type: "voiceClone" })}
            onOpenSubjectPicker={() => setSubjectPickerOpen(true)}
          />
          {showStandaloneSubjectButton ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-background"
              onClick={() => setSubjectPickerOpen(true)}
            >
              <AtSign className="h-4 w-4" />
            </Button>
          ) : null}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              <Sparkles className="mr-1 inline h-3.5 w-3.5" />
              {formatCredits(generationCost)}
            </span>
            <Button type="submit" size="icon" className="rounded-full" disabled={!prompt.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        ) : null}
      </div>
      {!hideHelper && creationType === "agent" ? (
        <p className={cn("mt-3 text-center text-xs text-muted-foreground", helperClassName)}>
          当前为 Agent 模式，会根据你的提示词自动选择图片、视频、数字人或配音能力。
        </p>
      ) : !hideHelper ? (
        <p className={cn("mt-3 text-center text-xs text-muted-foreground", helperClassName)}>
          当前功能：{activeType.label}。按 Enter 开始生成，Shift + Enter 换行。
        </p>
      ) : null}
    </form>
  );
}

export function GenerateView({
  initialCreationType = "agent",
  jobs: controlledJobs,
  onJobsChange,
  onOpenCanvasEdit
}: {
  initialCreationType?: CreationType;
  jobs?: GenerationJob[];
  onJobsChange?: Dispatch<SetStateAction<GenerationJob[]>>;
  onOpenCanvasEdit?: (job: GenerationJob) => void;
}) {
  const [localJobs, setLocalJobs] = useState<GenerationJob[]>([]);
  const [creationType, setCreationType] = useState<CreationType>(initialCreationType);
  const [draftRequest, setDraftRequest] = useState<GenerationDraftRequest | null>(null);
  const [detailSelection, setDetailSelection] = useState<{ jobId: string; index: number } | null>(null);
  const spendCredits = useChatStore((state) => state.spendCredits);
  const addCredits = useChatStore((state) => state.addCredits);
  const showNotice = useChatStore((state) => state.showNotice);
  const jobs = controlledJobs ?? localJobs;
  const setJobs = onJobsChange ?? setLocalJobs;
  const hasRunningJob = jobs.some((job) => job.status === "running" && job.progress < runningProgressLimit);
  const detailJob = detailSelection ? jobs.find((job) => job.id === detailSelection.jobId) ?? null : null;

  useEffect(() => {
    setCreationType(initialCreationType);
  }, [initialCreationType]);

  useEffect(() => {
    let cancelled = false;
    void loadGenerationJobsFromDatabase()
      .then((records) => {
        if (!cancelled) {
          setJobs((current) => mergeGenerationJobs(current, records));
        }
      })
      .catch(() => {
        if (!cancelled) {
          showNotice("生成记录加载失败，请刷新后重试。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setJobs, showNotice]);

  useEffect(() => {
    if (!hasRunningJob) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setJobs((current) =>
        current.map((job) =>
          job.progress >= runningProgressLimit || job.status !== "running"
            ? job
            : {
                ...job,
                progress: Math.min(
                  runningProgressLimit,
                  job.progress + (isVideoCreationType(job.type) ? 4 : 7)
                )
              }
        )
      );
    }, 420);
    return () => window.clearInterval(timer);
  }, [hasRunningJob, setJobs]);

  function addJob(job: GenerationJob): void {
    setJobs((current) => [...current, job]);
    void saveGenerationJobToDatabase(job).catch(() => {
      showNotice("生成记录保存失败，请稍后重试。");
    });
  }

  function updateJob(jobId: string, patch: Partial<GenerationJob>): void {
    setJobs((current) => current.map((job) => (job.id === jobId ? { ...job, ...patch } : job)));
    void updateGenerationJobInDatabase(jobId, patch).catch(() => {
      showNotice("生成记录更新失败，请稍后重试。");
    });
  }

  function editJob(job: GenerationJob): void {
    setCreationType(job.type);
    setDraftRequest({
      nonce: Date.now(),
      type: job.type,
      prompt: job.prompt,
      ratio: job.ratio
    });
  }

  function regenerateJob(job: GenerationJob): void {
    const cost =
      job.cost ||
      calculateGenerationCost({
        type: job.type,
        duration: job.duration,
        outputCount: job.outputCount,
        resolution: job.resolution ?? "2K",
        materialsCount: job.sourceMaterials.length
      });
    if (!spendCredits(cost, "再次生成")) {
      return;
    }
    const nextJob = {
      ...job,
      id: crypto.randomUUID(),
      progress: 1,
      status: "running" as const,
      outputUrls: undefined,
      resultText: undefined,
      taskId: undefined,
      error: undefined,
      createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      cost
    };
    setJobs((current) => [...current, nextJob]);
    void saveGenerationJobToDatabase(nextJob).catch(() => {
      showNotice("生成记录保存失败，请稍后重试。");
    });
    void requestGenerationResult(nextJob, [], nextJob.resolution ?? "2K")
      .then((result) => {
        updateJob(nextJob.id, generationResultToPatch(nextJob, result));
        continueSubmittedGeneration(nextJob, result, updateJob);
      })
      .catch((error) => {
        addCredits(cost, "生成失败退回");
        updateJob(nextJob.id, {
          progress: 100,
          status: "failed",
          error: error instanceof Error ? error.message : "Generation failed."
        });
      });
  }

  function deleteJob(job: GenerationJob): void {
    setJobs((current) => current.filter((item) => item.id !== job.id));
    void deleteGenerationJobFromDatabase(job.id).catch(() => {
      showNotice("生成记录删除失败，请稍后重试。");
    });
  }

  function deleteJobOutput(job: GenerationJob, index: number): void {
    let persistedPatch: Partial<GenerationJob> | null = null;
    let deleteEntireJob = false;
    setJobs((current) =>
      current.flatMap((item) => {
        if (item.id !== job.id) {
          return [item];
        }
        if (item.outputUrls && item.outputUrls.length > 1) {
          const outputUrls = item.outputUrls.filter((_, outputIndex) => outputIndex !== index);
          persistedPatch = { outputUrls, outputCount: outputUrls.length };
          return [{ ...item, outputUrls, outputCount: outputUrls.length }];
        }
        if (!item.outputUrls && item.outputCount > 1) {
          const outputCount = item.outputCount - 1;
          persistedPatch = { outputCount };
          return [{ ...item, outputCount }];
        }
        deleteEntireJob = true;
        return [];
      })
    );
    if (deleteEntireJob) {
      void deleteGenerationJobFromDatabase(job.id).catch(() => {
        showNotice("生成记录删除失败，请稍后重试。");
      });
    } else if (persistedPatch) {
      void updateGenerationJobInDatabase(job.id, persistedPatch).catch(() => {
        showNotice("生成记录更新失败，请稍后重试。");
      });
    }
  }

  function publishJob(job: GenerationJob): void {
    showNotice(`${job.type === "image" ? "图片" : "结果"}已加入发布流程。`);
  }

  function favoriteJob(job: GenerationJob): void {
    showNotice(`${job.type === "image" ? "图片" : "结果"}已收藏。`);
  }

  function reportJob(): void {
    showNotice("举报已提交，我们会尽快处理。");
  }

  return (
    <section className="relative min-h-0 flex-1 overflow-hidden px-4">
      <div className="no-scrollbar h-full overflow-y-auto pb-64 pt-8">
        <div
          className={cn(
            "mx-auto flex min-h-full w-full max-w-7xl flex-col items-center",
            jobs.length > 0 ? "justify-start" : "justify-center pb-16"
          )}
        >
          {jobs.length > 0 ? (
            <GenerationBoard
              jobs={jobs}
              onEdit={editJob}
              onRegenerate={regenerateJob}
              onDelete={deleteJob}
              onDeleteOutput={deleteJobOutput}
              onOpenCanvasEdit={onOpenCanvasEdit}
              onOpenDetail={(job, index) => setDetailSelection({ jobId: job.id, index })}
              onPublish={publishJob}
              onReport={reportJob}
            />
          ) : null}
          {jobs.length === 0 ? (
            <h1 className="mb-10 text-center text-2xl font-semibold tracking-tight">你好，想创作什么？</h1>
          ) : null}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-5 pt-16">
        <div className="pointer-events-auto mx-auto w-full max-w-[920px]">
          <GenerationComposer
            draftRequest={draftRequest}
            selectedCreationType={creationType}
            onCreationTypeChange={setCreationType}
            onGenerate={addJob}
            onGenerationUpdate={updateJob}
          />
        </div>
      </div>
      <ResultDetailDialog
        job={detailJob}
        index={detailSelection?.index ?? 0}
        open={Boolean(detailSelection && detailJob)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailSelection(null);
          }
        }}
        onDeleteOutput={deleteJobOutput}
        onFavorite={favoriteJob}
        onPublish={publishJob}
      />
    </section>
  );
}
