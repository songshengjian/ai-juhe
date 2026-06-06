"use client";

import { useEffect, useState } from "react";
import { Folder, Menu, Share2, X } from "lucide-react";

import { AppsView } from "@/components/chat/apps-view";
import { AudioView } from "@/components/chat/audio-view";
import { CanvasView } from "@/components/chat/canvas-view";
import { Composer } from "@/components/chat/composer";
import {
  GenerateView,
  saveGenerationJobToDatabase,
  updateGenerationJobInDatabase,
  type CreationType,
  type GenerationJob
} from "@/components/chat/generate-view";
import { HomeView } from "@/components/chat/home-view";
import { LibraryView } from "@/components/chat/library-view";
import { MessageList } from "@/components/chat/message-list";
import { ModelSelector } from "@/components/chat/model-selector";
import { ProjectDialog } from "@/components/chat/project-dialog";
import { SearchDialog } from "@/components/chat/search-dialog";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat-store";
import type { WorkspaceView } from "@/types";

interface ChatShellProps {
  userName: string;
  userEmail: string;
  initialView?: WorkspaceView;
  initialGenerationType?: CreationType;
}

const workspaceViewStorageKey = "ai-juhe-active-workspace-view";
const generationTypeStorageKey = "ai-juhe-active-generation-type";

export function ChatShell({
  userName,
  userEmail,
  initialView = "home",
  initialGenerationType = "agent"
}: ChatShellProps) {
  const messages = useChatStore((state) => state.messages);
  const projects = useChatStore((state) => state.projects);
  const activeProjectId = useChatStore((state) => state.activeProjectId);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const error = useChatStore((state) => state.error);
  const notice = useChatStore((state) => state.notice);
  const clearError = useChatStore((state) => state.clearError);
  const clearNotice = useChatStore((state) => state.clearNotice);
  const loadConversations = useChatStore((state) => state.loadConversations);
  const loadProjects = useChatStore((state) => state.loadProjects);
  const loadAssets = useChatStore((state) => state.loadAssets);
  const createProject = useChatStore((state) => state.createProject);
  const shareProject = useChatStore((state) => state.shareProject);
  const setSidebarOpen = useChatStore((state) => state.setSidebarOpen);
  const [view, setView] = useState<WorkspaceView>(initialView);
  const [generateCreationType, setGenerateCreationType] = useState<CreationType>(initialGenerationType);
  const [generateJobs, setGenerateJobs] = useState<GenerationJob[]>([]);
  const [canvasInitialJob, setCanvasInitialJob] = useState<GenerationJob | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;

  useEffect(() => {
    void Promise.all([loadConversations(), loadProjects(), loadAssets(null)]);
  }, [loadAssets, loadConversations, loadProjects]);

  useEffect(() => {
    window.localStorage.setItem(workspaceViewStorageKey, view);
    window.localStorage.setItem(generationTypeStorageKey, generateCreationType);
    const params = new URLSearchParams(window.location.search);
    if (view === "home") {
      params.delete("view");
      params.delete("type");
    } else {
      params.set("view", view);
      if (view === "generate") {
        params.set("type", generateCreationType);
      } else {
        params.delete("type");
      }
    }
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [generateCreationType, view]);

  useEffect(() => {
    if (view === "library") {
      void loadAssets(null);
    }
  }, [loadAssets, view]);

  async function handleCreateProject(name: string): Promise<boolean> {
    const project = await createProject(name);
    if (!project) {
      return false;
    }
    setView("chat");
    return true;
  }

  function selectWorkspaceView(nextView: WorkspaceView): void {
    if (nextView === "generate") {
      setGenerateCreationType("agent");
    }
    if (nextView === "canvas") {
      setCanvasInitialJob(null);
    }
    setView(nextView);
  }

  const isEmpty = messages.length === 0;
  const showProjectLanding = Boolean(activeProject && !activeConversationId && isEmpty);

  function openGenerateTemplate(type: CreationType): void {
    setGenerateCreationType(type);
    setView("generate");
  }

  function openGeneratedJob(job: GenerationJob): void {
    setGenerateCreationType(job.type);
    setGenerateJobs((current) => [...current, job]);
    void saveGenerationJobToDatabase(job).catch(() => {
      // GenerateView will surface database load failures when the user opens the workspace.
    });
    setView("generate");
  }

  function updateGeneratedJob(jobId: string, patch: Partial<GenerationJob>): void {
    setGenerateJobs((current) => current.map((job) => (job.id === jobId ? { ...job, ...patch } : job)));
    void updateGenerationJobInDatabase(jobId, patch).catch(() => {
      // The in-memory result remains visible; persistence errors are retried on later updates.
    });
  }

  function openCanvasEditor(job: GenerationJob): void {
    setCanvasInitialJob(job);
    setView("canvas");
  }

  return (
    <div className="dark relative h-screen overflow-hidden bg-[#050608] text-foreground">
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        activeView={view}
        onOpenNewProject={() => setProjectOpen(true)}
        onOpenSearch={() => {
          setView("chat");
          setSearchOpen(true);
        }}
        onSelectView={selectWorkspaceView}
      />
      <main className={cn("relative flex h-full min-w-0 flex-col", view !== "home" && "md:pl-[92px]")}>
        {view === "home" ? (
          <HomeView
            onOpenGenerateTemplate={openGenerateTemplate}
            onGenerateJob={openGeneratedJob}
            onGenerationUpdate={updateGeneratedJob}
            onOpenMenu={() => setSidebarOpen(true)}
          />
        ) : view === "chat" ? (
          <>
            <header className="flex h-14 shrink-0 items-center justify-between px-3 md:px-5">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  aria-label="打开侧栏"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <ModelSelector />
              </div>
              <div className="flex items-center gap-1">
                {activeProject ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="font-normal"
                    onClick={() => void shareProject(activeProject.id)}
                  >
                    <Share2 className="h-4 w-4" />
                    分享
                  </Button>
                ) : null}
                <ThemeToggle />
              </div>
            </header>
            {showProjectLanding && activeProject ? (
              <section className="flex-1 overflow-y-auto px-4">
                <div className="mx-auto w-full max-w-3xl pt-14">
                  <h1 className="mb-10 flex items-center gap-3 text-3xl font-semibold tracking-tight">
                    <Folder className="h-8 w-8" />
                    {activeProject.name}
                  </h1>
                  <Composer projectName={activeProject.name} />
                  <div className="mt-8 flex items-center gap-5 border-b pb-3 text-sm">
                    <span className="rounded-full bg-accent px-4 py-2">聊天</span>
                    <span className="text-muted-foreground">来源</span>
                  </div>
                  <div className="pt-32 text-center text-sm text-muted-foreground">
                    <p className="text-foreground">尚无聊天</p>
                    <p className="mt-2">{activeProject.name} 的聊天将显示在此处</p>
                  </div>
                </div>
              </section>
            ) : isEmpty ? (
              <section className="flex flex-1 items-center justify-center px-4 pb-24">
                <div className="flex w-full flex-col items-center">
                  <h1 className="mb-12 text-center text-2xl font-semibold tracking-tight">
                    你今天在想些什么？
                  </h1>
                  <Composer showSuggestions />
                </div>
              </section>
            ) : (
              <>
                <MessageList />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background to-transparent px-4 pb-5 pt-14">
                  <div className="pointer-events-auto mx-auto max-w-3xl">
                    <Composer projectName={activeProject?.name} />
                  </div>
                </div>
              </>
            )}
          </>
        ) : view === "canvas" ? (
          <CanvasView
            onOpenMenu={() => setSidebarOpen(true)}
            initialJob={canvasInitialJob}
            onInitialJobConsumed={() => setCanvasInitialJob(null)}
          />
        ) : (
          <>
            <header className="flex h-14 shrink-0 items-center justify-between px-3 md:px-5">
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                aria-label="打开侧栏"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <ThemeToggle />
            </header>
            {view === "library" ? <LibraryView /> : null}
            {view === "apps" ? <AppsView /> : null}
            {view === "audio" ? <AudioView /> : null}
            {view === "generate" ? (
              <GenerateView
                initialCreationType={generateCreationType}
                jobs={generateJobs}
                onJobsChange={setGenerateJobs}
                onOpenCanvasEdit={openCanvasEditor}
              />
            ) : null}
          </>
        )}
        {error ? (
          <div className="absolute bottom-24 left-1/2 flex max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border bg-popover px-4 py-3 text-sm shadow-md">
            <span>{error}</span>
            <Button variant="ghost" size="icon-sm" onClick={clearError} aria-label="关闭提示">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
        {notice ? (
          <div className="absolute bottom-24 left-1/2 flex max-w-xl -translate-x-1/2 items-center gap-3 rounded-lg border bg-popover px-4 py-3 text-sm shadow-md">
            <span className="break-all">{notice}</span>
            <Button variant="ghost" size="icon-sm" onClick={clearNotice} aria-label="关闭提示">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </main>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <ProjectDialog open={projectOpen} onOpenChange={setProjectOpen} onCreate={handleCreateProject} />
    </div>
  );
}
