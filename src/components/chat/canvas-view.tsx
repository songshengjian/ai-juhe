"use client";

import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent
} from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  FileImage,
  FileVideo,
  FolderPlus,
  ImagePlus,
  Layers3,
  Menu,
  Network,
  PanelBottomOpen,
  Plus,
  Sparkles,
  Upload,
  Video,
  Wand2,
  ZoomIn,
  ZoomOut
} from "lucide-react";

import {
  GenerationComposer,
  type CreationType,
  type GenerationJob
} from "@/components/chat/generate-view";
import { Button } from "@/components/ui/button";
import { calculateGenerationCost } from "@/lib/generation-billing";
import { cn } from "@/lib/utils";

type CanvasScreen = "landing" | "workspace";
type CanvasNodeTone = "prompt" | "agent" | "result";

interface CanvasProject {
  id: string;
  name: string;
  description: string;
  type: CreationType;
  updatedAt: string;
  jobs: GenerationJob[];
}

interface CanvasNode {
  id: string;
  jobId: string;
  tone: CanvasNodeTone;
  title: string;
  eyebrow: string;
  description: string;
  x: number;
  y: number;
  width: number;
  progress?: number;
  creationType: CreationType;
}

interface CanvasConnection {
  id: string;
  from: string;
  to: string;
}

const quickStarts: Array<{
  title: string;
  description: string;
  type: CreationType;
  icon: typeof Sparkles;
  prompt: string;
}> = [
  {
    title: "文生图画布",
    description: "提示词自动拆成主体、风格和结果图节点。",
    type: "image",
    icon: ImagePlus,
    prompt: "生成一张赛博城市夜景海报，雨后街道反光，霓虹灯牌，高级商业摄影。"
  },
  {
    title: "文生视频分镜",
    description: "从一句话生成镜头、运动和预览结果链路。",
    type: "video",
    icon: Video,
    prompt: "一支香水广告短片，玻璃瓶从水面升起，微距镜头，慢动作水滴飞散。"
  },
  {
    title: "主体一致性",
    description: "上传角色或商品后作为主体贯穿多张图。",
    type: "agent",
    icon: Bot,
    prompt: "用同一个主体生成三张不同场景的品牌视觉：海边、城市天台和展厅。"
  },
  {
    title: "动作模仿",
    description: "角色图和动作参考自动连成动作生成流程。",
    type: "motion",
    icon: Wand2,
    prompt: "让上传角色模仿参考视频中的转身走位，镜头轻微环绕，画面干净。"
  }
];

const recentSeedProjects: CanvasProject[] = [
  {
    id: "brand-board",
    name: "茶饮新品视觉链路",
    description: "商品主体、KV 图和短视频预览已连线。",
    type: "image",
    updatedAt: "今天 10:18",
    jobs: [
      createSeedJob("image", "中式茶饮新品海报，竹影、青绿色包装、清晨柔光，电商主视觉。", "Doubao-Seedream-5.0-lite", 100)
    ]
  },
  {
    id: "story-board",
    name: "短片分镜测试",
    description: "脚本、镜头运动和视频结果正在生成。",
    type: "video",
    updatedAt: "昨天 18:42",
    jobs: [
      createSeedJob("video", "雨夜侦探走进霓虹街巷，镜头跟随背影，电影感蓝红对比。", "Seedance 1.0 Fast", 72)
    ]
  },
  {
    id: "avatar-board",
    name: "数字人口播 Demo",
    description: "台词、音色和角色视频节点已整理。",
    type: "avatar",
    updatedAt: "05月27日",
    jobs: [
      createSeedJob("avatar", "科技主持人介绍新品功能，透明屏幕背景，语气专业自然。", "数字人快速模式", 100)
    ]
  }
];

function createSeedJob(
  type: CreationType,
  prompt: string,
  model: string,
  progress: number
): GenerationJob {
  return {
    id: `seed-${type}-${prompt.length}-${progress}`,
    type,
    prompt,
    ratio: "16:9",
    progress,
    model,
    duration: type === "image" ? "1张" : "5s",
    createdAt: "最近",
    outputCount: type === "image" ? 4 : 1,
    sourceMaterials: [],
    cost: calculateGenerationCost({
      type,
      duration: type === "image" ? "1张" : "5s",
      outputCount: type === "image" ? 4 : 1
    })
  };
}

function createProjectName(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return "未命名画布";
  }
  return `${trimmed.slice(0, 12)}${trimmed.length > 12 ? "..." : ""}`;
}

function getTypeLabel(type: CreationType): string {
  if (type === "image") {
    return "图片";
  }
  if (type === "video") {
    return "视频";
  }
  if (type === "avatar") {
    return "数字人";
  }
  if (type === "voice") {
    return "配音";
  }
  if (type === "motion") {
    return "动作";
  }
  return "Agent";
}

function getResultIcon(type: CreationType) {
  if (type === "video" || type === "avatar" || type === "motion") {
    return FileVideo;
  }
  return FileImage;
}

function buildCanvasGraph(jobs: GenerationJob[]): {
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  width: number;
  height: number;
} {
  const nodes: CanvasNode[] = [];
  const connections: CanvasConnection[] = [];
  jobs.forEach((job, index) => {
    const y = 140 + index * 220;
    const promptId = `${job.id}-prompt`;
    const agentId = `${job.id}-agent`;
    const resultId = `${job.id}-result`;
    nodes.push(
      {
        id: promptId,
        jobId: job.id,
        tone: "prompt",
        title: "提示词",
        eyebrow: getTypeLabel(job.type),
        description: job.prompt,
        x: 120,
        y,
        width: 280,
        creationType: job.type
      },
      {
        id: agentId,
        jobId: job.id,
        tone: "agent",
        title: "Agent 编排",
        eyebrow: job.model,
        description:
          job.type === "video" || job.type === "motion"
            ? "拆解镜头、主体、运动和时长，自动准备视频生成参数。"
            : "拆解主体、风格、画幅和模型参数，准备生成结果。",
        x: 520,
        y: y + 22,
        width: 260,
        creationType: job.type
      },
      {
        id: resultId,
        jobId: job.id,
        tone: "result",
        title: `${getTypeLabel(job.type)}结果`,
        eyebrow: job.progress >= 100 ? "已完成" : `生成中 ${job.progress}%`,
        description:
          job.progress >= 100
            ? "结果已完成，可以继续接入变体、放大、转视频或二次编辑节点。"
            : "正在模拟生成，完成后会停在画布上继续编辑。",
        x: 900,
        y,
        width: 300,
        progress: job.progress,
        creationType: job.type
      }
    );
    connections.push(
      { id: `${job.id}-prompt-agent`, from: promptId, to: agentId },
      { id: `${job.id}-agent-result`, from: agentId, to: resultId }
    );
  });

  return {
    nodes,
    connections,
    width: 1320,
    height: Math.max(720, 260 + jobs.length * 220)
  };
}

function CanvasConnector({
  connection,
  nodesById
}: {
  connection: CanvasConnection;
  nodesById: Map<string, CanvasNode>;
}) {
  const from = nodesById.get(connection.from);
  const to = nodesById.get(connection.to);
  if (!from || !to) {
    return null;
  }
  const x1 = from.x + from.width;
  const y1 = from.y + 66;
  const x2 = to.x;
  const y2 = to.y + 66;
  const curve = Math.max(90, (x2 - x1) / 2);

  return (
    <path
      d={`M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`}
      fill="none"
      stroke="rgba(255, 255, 255, .24)"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  );
}

function CanvasNodeCard({
  node,
  onClick
}: {
  node: CanvasNode;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  const ResultIcon = getResultIcon(node.creationType);
  const icon =
    node.tone === "prompt" ? (
      <Bot className="h-4 w-4" />
    ) : node.tone === "agent" ? (
      <Network className="h-4 w-4" />
    ) : (
      <ResultIcon className="h-4 w-4" />
    );

  return (
    <div
      onClick={onClick}
      className={cn(
        "absolute rounded-[8px] border bg-[#111216]/90 p-4 text-white shadow-xl shadow-black/35 backdrop-blur",
        node.tone === "prompt" && "border-cyan-300/30",
        node.tone === "agent" && "border-white/15",
        node.tone === "result" && "border-emerald-300/30"
      )}
      style={{ left: node.x, top: node.y, width: node.width }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">
          {icon}
          {node.eyebrow}
        </span>
        {node.tone === "result" && node.progress !== undefined ? (
          node.progress >= 100 ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <Clock3 className="h-5 w-5 text-cyan-600" />
          )
        ) : null}
      </div>
      <div className="text-sm font-semibold">{node.title}</div>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/60">{node.description}</p>
      {node.tone === "result" && node.progress !== undefined ? (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${node.progress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function CanvasLandingCard({
  project,
  onOpen
}: {
  project: CanvasProject;
  onOpen: (project: CanvasProject) => void;
}) {
  const Icon = getResultIcon(project.type);
  return (
    <button
      type="button"
      onClick={() => onOpen(project)}
      className="min-h-[150px] rounded-[8px] border border-white/10 bg-white/[.07] p-4 text-left text-white shadow-xl shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[.1]"
    >
      <div className="mb-6 flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white/10 text-white/75">
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-xs text-white/40">{project.updatedAt}</span>
      </div>
      <div className="truncate text-sm font-semibold text-white">{project.name}</div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/60">{project.description}</p>
    </button>
  );
}

export function CanvasView({
  onOpenMenu,
  initialJob,
  onInitialJobConsumed
}: {
  onOpenMenu: () => void;
  initialJob?: GenerationJob | null;
  onInitialJobConsumed?: () => void;
}) {
  const [screen, setScreen] = useState<CanvasScreen>("landing");
  const [recentProjects, setRecentProjects] = useState<CanvasProject[]>(recentSeedProjects);
  const [activeProject, setActiveProject] = useState<CanvasProject | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [composerExpanded, setComposerExpanded] = useState(true);
  const graph = useMemo(() => buildCanvasGraph(jobs), [jobs]);
  const nodesById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const hasRunningJob = jobs.some((job) => job.progress < 100);

  useEffect(() => {
    if (!hasRunningJob) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setJobs((current) =>
        current.map((job) =>
          job.progress >= 100 ? job : { ...job, progress: Math.min(100, job.progress + 6) }
        )
      );
    }, 480);
    return () => window.clearInterval(timer);
  }, [hasRunningJob]);

  function openProject(project: CanvasProject): void {
    setActiveProject(project);
    setJobs(project.jobs);
    setComposerExpanded(project.jobs.length === 0);
    setScreen("workspace");
  }

  function createBlankProject(): void {
    const project: CanvasProject = {
      id: crypto.randomUUID(),
      name: "未命名画布",
      description: "空白画布，等待新的提示词节点。",
      type: "agent",
      updatedAt: "刚刚",
      jobs: []
    };
    setRecentProjects((current) => [project, ...current].slice(0, 8));
    openProject(project);
  }

  function openFromJob(job: GenerationJob): void {
    const project: CanvasProject = {
      id: crypto.randomUUID(),
      name: createProjectName(job.prompt),
      description: "由输入框直接生成的画布流程。",
      type: job.type,
      updatedAt: "刚刚",
      jobs: [job]
    };
    setRecentProjects((current) => [project, ...current].slice(0, 8));
    openProject(project);
  }

  useEffect(() => {
    if (!initialJob) {
      return;
    }
    const project: CanvasProject = {
      id: crypto.randomUUID(),
      name: createProjectName(initialJob.prompt),
      description: "由生成结果进入的画布流程。",
      type: initialJob.type,
      updatedAt: "刚刚",
      jobs: [initialJob]
    };
    setRecentProjects((current) => [project, ...current].slice(0, 8));
    setActiveProject(project);
    setJobs(project.jobs);
    setComposerExpanded(project.jobs.length === 0);
    setScreen("workspace");
    onInitialJobConsumed?.();
  }, [initialJob, onInitialJobConsumed]);

  function openQuickStart(prompt: string, type: CreationType): void {
    openFromJob({
      id: crypto.randomUUID(),
      type,
      prompt,
      ratio: "16:9",
      progress: 1,
      model: type === "video" ? "Seedance 1.0 Fast" : type === "image" ? "Doubao-Seedream-5.0-lite" : "Doubao-Seed-2.0-lite",
      duration: type === "image" ? "1张" : "5s",
      createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      outputCount: type === "image" ? 4 : 1,
      sourceMaterials: [],
      cost: calculateGenerationCost({
        type,
        duration: type === "image" ? "1张" : "5s",
        outputCount: type === "image" ? 4 : 1
      })
    });
  }

  function addWorkspaceJob(job: GenerationJob): void {
    setJobs((current) => [job, ...current]);
    setActiveProject((current) =>
      current
        ? {
            ...current,
            description: "提示词、编排和结果节点已自动连线。",
            type: job.type,
            updatedAt: "刚刚",
            jobs: [job, ...current.jobs]
          }
        : current
    );
    setRecentProjects((current) =>
      current.map((project) =>
        project.id === activeProject?.id
          ? {
              ...project,
              description: "提示词、编排和结果节点已自动连线。",
              type: job.type,
              updatedAt: "刚刚",
              jobs: [job, ...project.jobs]
            }
          : project
      )
    );
  }

  if (screen === "workspace") {
    return (
      <section
        className="relative h-full overflow-hidden bg-[#050608] text-white"
        onClick={() => setComposerExpanded(false)}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(0,194,255,.12),transparent_34%),radial-gradient(circle_at_80%_18%,rgba(255,119,64,.09),transparent_32%),linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,0)_34%)]" />
        <header
          className="relative z-30 flex h-12 items-center justify-between border-b border-white/10 bg-[#07080d]/90 px-3 backdrop-blur"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="打开侧栏" onClick={onOpenMenu}>
              <Menu className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="返回画布首页" onClick={() => setScreen("landing")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 text-white/75" />
              <span className="truncate text-sm font-semibold">{activeProject?.name ?? "未命名画布"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span className="hidden sm:inline">自动连线</span>
            <span className="rounded-full bg-emerald-400/12 px-2 py-1 text-emerald-200">Beta</span>
          </div>
        </header>

        <div
          className="absolute left-3 top-1/2 z-30 flex -translate-y-1/2 flex-col rounded-xl border border-white/10 bg-[#0b0c11]/85 p-1 shadow-2xl shadow-black/35 backdrop-blur"
          onClick={(event) => event.stopPropagation()}
        >
          {[
            { label: "上传", icon: Upload },
            { label: "资产", icon: Layers3 },
            { label: "节点", icon: Network },
            { label: "文本", icon: PanelBottomOpen }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Button key={item.label} type="button" variant="ghost" size="icon-sm" aria-label={item.label}>
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>

        <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 text-xs text-white/60">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="缩小" onClick={(event) => event.stopPropagation()}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span>16%</span>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="放大" onClick={(event) => event.stopPropagation()}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <div
          className="h-full overflow-auto"
          style={{
            backgroundImage: "radial-gradient(rgba(255, 255, 255, .1) 1px, transparent 1px)",
            backgroundSize: "28px 28px"
          }}
        >
          <div className="relative" style={{ width: graph.width, height: graph.height }}>
            {jobs.length === 0 ? (
              <div className="absolute left-1/2 top-[34%] w-[360px] -translate-x-1/2 text-center">
                <h2 className="text-lg font-semibold">这次创作想从哪里开始？</h2>
                <p className="mt-4 text-sm leading-6 text-white/60">
                  上传素材、选择主体，或直接在下方输入提示词。生成后会自动出现节点和连线。
                </p>
                <div className="mx-auto mt-8 h-20 w-20 rounded-full border border-dashed border-white/20" />
              </div>
            ) : (
              <>
                <svg className="absolute left-0 top-0" width={graph.width} height={graph.height}>
                  {graph.connections.map((connection) => (
                    <CanvasConnector key={connection.id} connection={connection} nodesById={nodesById} />
                  ))}
                </svg>
                {graph.nodes.map((node) => (
                  <CanvasNodeCard
                    key={node.id}
                    node={node}
                    onClick={(event) => event.stopPropagation()}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        <div
          className="absolute inset-x-0 bottom-6 z-40 flex justify-center px-4"
          onClick={(event) => event.stopPropagation()}
        >
          <GenerationComposer
            canvasMode
            expanded={composerExpanded}
            hideHelper
            onFocusWithin={() => setComposerExpanded(true)}
            onGenerate={addWorkspaceJob}
            className={cn("max-w-[440px]", composerExpanded && "max-w-[920px]")}
            panelClassName="border-white/15 bg-[#101116]/95 text-white shadow-2xl shadow-black/40 backdrop-blur-xl"
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative h-full overflow-y-auto bg-[#050608] text-white"
    >
      <div className="pointer-events-none fixed inset-0 hidden overflow-hidden bg-[#050608] md:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_12%,rgba(0,194,255,.15),transparent_32%),radial-gradient(circle_at_78%_20%,rgba(255,119,64,.1),transparent_34%),linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,0)_36%)]" />
        <div className="home-scanlines absolute inset-0 opacity-15" />
      </div>
      <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#050608] md:hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_12%,rgba(0,194,255,.15),transparent_32%),radial-gradient(circle_at_78%_20%,rgba(255,119,64,.1),transparent_34%),linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,0)_36%)]" />
        <div className="home-scanlines absolute inset-0 opacity-15" />
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute left-4 top-4 z-30 border border-white/10 bg-white/10 text-white backdrop-blur md:hidden"
        aria-label="打开侧栏"
        onClick={onOpenMenu}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 pb-16 pt-16 lg:px-10">
        <div className="mx-auto w-full max-w-5xl">
          <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight">
            今天想在无限画布创作什么？
          </h1>
          <GenerationComposer
            onGenerate={openFromJob}
            className="mx-auto max-w-[920px]"
            panelClassName="border-white/15 bg-[#101116]/85 text-white shadow-2xl shadow-black/30 backdrop-blur-xl"
            helperClassName="text-white/60"
          />
        </div>

        <section className="mt-14">
          <h2 className="text-sm font-semibold text-white">快速开始</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {quickStarts.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => openQuickStart(item.prompt, item.type)}
                  className="min-h-[128px] rounded-[8px] border border-white/10 bg-white/[.07] p-4 text-left text-white shadow-xl shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[.1]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white/10 text-white/75">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="mt-5 block text-sm font-semibold text-white">{item.title}</span>
                  <span className="mt-2 block text-xs leading-5 text-white/60">{item.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-white">最近项目</h2>
            <Button type="button" variant="outline" className="border-white/15 bg-white/[.07] text-white hover:bg-white/[.12]" onClick={createBlankProject}>
              <FolderPlus className="h-4 w-4" />
              新建项目
            </Button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={createBlankProject}
              className="flex min-h-[150px] flex-col items-center justify-center rounded-[8px] border border-dashed border-white/20 bg-white/[.045] text-white/60 transition hover:border-white/30 hover:bg-white/[.08]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <Plus className="h-6 w-6" />
              </span>
              <span className="mt-4 text-sm font-medium text-white">新建项目</span>
            </button>
            {recentProjects.map((project) => (
              <CanvasLandingCard key={project.id} project={project} onOpen={openProject} />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
