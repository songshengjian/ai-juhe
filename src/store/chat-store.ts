"use client";

import { create, type StoreApi } from "zustand";
import { z } from "zod";

import {
  DEFAULT_MODEL_ID,
  MODEL_IDS,
  type AssetSummary,
  type ChatMessage,
  type ChatStreamEvent,
  type ConversationDetail,
  type ConversationSummary,
  type ModelId,
  type ProjectSummary
} from "@/types";
import {
  DEFAULT_CREDIT_POOLS,
  TEST_RECHARGE_CREDITS,
  type CreditPools
} from "@/lib/generation-billing";

const modelSchema = z.enum(MODEL_IDS);
const assetSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  projectId: z.string().nullable(),
  createdAt: z.string(),
  contentUrl: z.string(),
  textExtracted: z.boolean(),
  parseError: z.string().nullable()
});
const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(["USER", "ASSISTANT", "SYSTEM"]),
  content: z.string(),
  createdAt: z.string(),
  totalTokens: z.number().int().nullable(),
  attachments: z.array(assetSchema)
});
const summarySchema = z.object({
  id: z.string(),
  title: z.string(),
  modelId: modelSchema,
  projectId: z.string().nullable(),
  updatedAt: z.string()
});
const detailSchema = summarySchema.extend({ messages: z.array(messageSchema) });
const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  shared: z.boolean(),
  updatedAt: z.string()
});
const streamSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("status"), status: z.enum(["thinking", "answering"]) }),
  z.object({ type: z.literal("delta"), delta: z.string() }),
  z.object({
    type: z.literal("done"),
    messageId: z.string().nullable(),
    totalTokens: z.number().int().nullable()
  }),
  z.object({ type: z.literal("error"), error: z.string() })
]);

interface ChatState {
  credits: number;
  creditPools: CreditPools;
  conversations: ConversationSummary[];
  projects: ProjectSummary[];
  assets: AssetSummary[];
  pendingAssets: AssetSummary[];
  activeConversationId: string | null;
  activeProjectId: string | null;
  messages: ChatMessage[];
  selectedModel: ModelId;
  search: string;
  draft: string;
  error: string | null;
  notice: string | null;
  loadingConversation: boolean;
  uploading: boolean;
  isStreaming: boolean;
  sidebarOpen: boolean;
  abortController: AbortController | null;
  spendCredits: (amount: number, reason: string) => boolean;
  addCredits: (amount: number, reason: string) => void;
  setDraft: (draft: string) => void;
  setSidebarOpen: (open: boolean) => void;
  clearError: () => void;
  clearNotice: () => void;
  showNotice: (notice: string) => void;
  loadConversations: (search?: string) => Promise<void>;
  loadProjects: () => Promise<void>;
  createProject: (name: string) => Promise<ProjectSummary | null>;
  renameProject: (projectId: string, name: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  shareProject: (projectId: string) => Promise<void>;
  openProject: (projectId: string) => Promise<void>;
  loadAssets: (projectId?: string | null) => Promise<void>;
  uploadFiles: (files: FileList | File[]) => Promise<void>;
  attachAsset: (asset: AssetSummary) => void;
  removePendingAsset: (assetId: string) => void;
  startNewConversation: (keepProject?: boolean) => void;
  openConversation: (conversationId: string) => Promise<void>;
  selectModel: (modelId: ModelId) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  sendMessage: (content?: string) => Promise<void>;
  regenerateLastResponse: () => Promise<void>;
  stopGenerating: () => void;
}

type SetState = StoreApi<ChatState>["setState"];
type GetState = StoreApi<ChatState>["getState"];
const CREDITS_STORAGE_KEY = "ai-juhe-credits";
const CREDIT_POOLS_STORAGE_KEY = "ai-juhe-credit-pools";
const TEST_CREDIT_GRANT_KEY = "ai-juhe-test-credit-grant-20260530";

function sumCreditPools(pools: CreditPools): number {
  return pools.free + pools.subscription + pools.recharge;
}

function normalizeCreditPools(value: unknown): CreditPools | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const candidate = value as Partial<Record<keyof CreditPools, unknown>>;
  const free = Number(candidate.free);
  const subscription = Number(candidate.subscription);
  const recharge = Number(candidate.recharge);
  if (![free, subscription, recharge].every((item) => Number.isFinite(item) && item >= 0)) {
    return null;
  }
  return { free, subscription, recharge };
}

function readInitialCreditPools(): CreditPools {
  if (typeof window === "undefined") {
    return DEFAULT_CREDIT_POOLS;
  }
  let storedPools: unknown = null;
  try {
    storedPools = JSON.parse(window.localStorage.getItem(CREDIT_POOLS_STORAGE_KEY) ?? "null");
  } catch {
    storedPools = null;
  }
  let pools = normalizeCreditPools(storedPools);
  if (!pools) {
    const legacyCredits = Number(window.localStorage.getItem(CREDITS_STORAGE_KEY));
    pools = {
      ...DEFAULT_CREDIT_POOLS,
      recharge: Number.isFinite(legacyCredits) && legacyCredits > 0 ? legacyCredits : DEFAULT_CREDIT_POOLS.recharge
    };
  }
  if (!window.localStorage.getItem(TEST_CREDIT_GRANT_KEY)) {
    pools = {
      ...pools,
      recharge: pools.recharge + TEST_RECHARGE_CREDITS
    };
    window.localStorage.setItem(TEST_CREDIT_GRANT_KEY, "granted");
  }
  persistCreditPools(pools);
  return pools;
}

function persistCreditPools(pools: CreditPools): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CREDIT_POOLS_STORAGE_KEY, JSON.stringify(pools));
    window.localStorage.setItem(CREDITS_STORAGE_KEY, String(sumCreditPools(pools)));
  }
}

function temporaryMessage(
  conversationId: string,
  role: ChatMessage["role"],
  content: string,
  attachments: AssetSummary[] = []
): ChatMessage {
  return {
    id: `temporary-${crypto.randomUUID()}`,
    conversationId,
    role,
    content,
    createdAt: new Date().toISOString(),
    totalTokens: null,
    attachments,
    pending: true,
    thinking: role === "ASSISTANT"
  };
}

async function readError(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      return payload.error;
    }
  } catch {
    return "请求失败，请稍后再试。";
  }
  return "请求失败，请稍后再试。";
}

async function parseJson<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const result = schema.safeParse(await response.json());
  if (!result.success) {
    throw new Error("服务器返回了无效数据。");
  }
  return result.data;
}

async function consumeEvents(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void
): Promise<void> {
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  if (!response.body) {
    throw new Error("未收到模型回复。");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    buffer += decoder.decode(result.value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const data = block
        .split("\n")
        .find((line) => line.startsWith("data:"))
        ?.slice(5)
        .trim();
      if (!data) {
        continue;
      }
      try {
        const event = streamSchema.safeParse(JSON.parse(data) as unknown);
        if (!event.success) {
          continue;
        }
        if (event.data.type === "error") {
          throw new Error(event.data.error);
        }
        onEvent(event.data);
      } catch (error) {
        if (error instanceof Error && error.message !== "Unexpected end of JSON input") {
          throw error;
        }
      }
    }
  }
}

async function streamReply(
  set: SetState,
  get: GetState,
  conversationId: string,
  content: string,
  attachmentIds: string[],
  persistUserMessage: boolean
): Promise<void> {
  const placeholder = temporaryMessage(conversationId, "ASSISTANT", "");
  const controller = new AbortController();
  set((state) => ({
    messages: [...state.messages, placeholder],
    isStreaming: true,
    abortController: controller,
    error: null
  }));
  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        conversationId,
        modelId: get().selectedModel,
        content,
        attachmentIds,
        persistUserMessage
      })
    });
    await consumeEvents(response, (event) => {
      if (event.type === "delta") {
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === placeholder.id
              ? { ...message, thinking: false, content: `${message.content}${event.delta}` }
              : message
          )
        }));
      }
      if (event.type === "status") {
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === placeholder.id
              ? { ...message, thinking: event.status === "thinking" }
              : message
          )
        }));
      }
      if (event.type === "done") {
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === placeholder.id
              ? {
                  ...message,
                  id: event.messageId ?? message.id,
                  totalTokens: event.totalTokens,
                  pending: false,
                  thinking: false
                }
              : message
          )
        }));
      }
    });
    await get().openConversation(conversationId);
    await Promise.all([get().loadConversations(get().search), get().loadProjects()]);
  } catch (error) {
    set((state) => ({
      messages: state.messages.filter((message) => message.id !== placeholder.id),
      error:
        error instanceof DOMException && error.name === "AbortError"
          ? null
          : error instanceof Error
            ? error.message
            : "生成回复失败。"
    }));
    await get().openConversation(conversationId).catch(() => undefined);
  } finally {
    set({ isStreaming: false, abortController: null });
  }
}

const initialCreditPools = readInitialCreditPools();

export const useChatStore = create<ChatState>((set, get) => ({
  credits: sumCreditPools(initialCreditPools),
  creditPools: initialCreditPools,
  conversations: [],
  projects: [],
  assets: [],
  pendingAssets: [],
  activeConversationId: null,
  activeProjectId: null,
  messages: [],
  selectedModel: DEFAULT_MODEL_ID,
  search: "",
  draft: "",
  error: null,
  notice: null,
  loadingConversation: false,
  uploading: false,
  isStreaming: false,
  sidebarOpen: false,
  abortController: null,
  spendCredits(amount, reason) {
    const cost = Math.max(0, Math.ceil(amount));
    if (cost === 0) {
      return true;
    }
    const current = get().credits;
    if (current < cost) {
      set({ error: `积分不足：${reason} 需要 ${cost} 积分，当前剩余 ${current}。` });
      return false;
    }
    let remaining = cost;
    const pools = { ...get().creditPools };
    const freeSpend = Math.min(pools.free, remaining);
    pools.free -= freeSpend;
    remaining -= freeSpend;
    const subscriptionSpend = Math.min(pools.subscription, remaining);
    pools.subscription -= subscriptionSpend;
    remaining -= subscriptionSpend;
    pools.recharge = Math.max(0, pools.recharge - remaining);
    const next = sumCreditPools(pools);
    persistCreditPools(pools);
    set({
      creditPools: pools,
      credits: next,
      notice: `${reason} 已扣除 ${cost} 积分，剩余 ${next}。`,
      error: null
    });
    return true;
  },
  addCredits(amount, reason) {
    const pools = {
      ...get().creditPools,
      recharge: get().creditPools.recharge + Math.max(0, Math.ceil(amount))
    };
    const next = sumCreditPools(pools);
    persistCreditPools(pools);
    set({ creditPools: pools, credits: next, notice: `${reason} 已到账，当前剩余 ${next} 积分。` });
  },
  setDraft: (draft) => set({ draft }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  clearError: () => set({ error: null }),
  clearNotice: () => set({ notice: null }),
  showNotice: (notice) => set({ notice }),
  async loadConversations(search = get().search) {
    try {
      const response = await fetch(`/api/conversations?search=${encodeURIComponent(search)}`);
      set({ conversations: await parseJson(response, z.array(summarySchema)), search });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "无法载入历史对话。" });
    }
  },
  async loadProjects() {
    try {
      const response = await fetch("/api/projects");
      set({ projects: await parseJson(response, z.array(projectSchema)) });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "无法载入项目。" });
    }
  },
  async createProject(name) {
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const project = await parseJson(response, projectSchema);
      set((state) => ({
        projects: [project, ...state.projects],
        activeProjectId: project.id,
        activeConversationId: null,
        messages: [],
        assets: [],
        pendingAssets: [],
        draft: "",
        sidebarOpen: false
      }));
      return project;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "无法创建项目。" });
      return null;
    }
  },
  async renameProject(projectId, name) {
    try {
      const project = await parseJson(
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        }),
        projectSchema
      );
      set((state) => ({
        projects: state.projects.map((entry) => (entry.id === projectId ? project : entry)),
        notice: "项目已重命名。"
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "无法重命名项目。" });
    }
  },
  async deleteProject(projectId) {
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      set((state) => ({
        projects: state.projects.filter((project) => project.id !== projectId),
        conversations: state.conversations.filter((conversation) => conversation.projectId !== projectId),
        activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId,
        activeConversationId: state.activeProjectId === projectId ? null : state.activeConversationId,
        messages: state.activeProjectId === projectId ? [] : state.messages,
        assets: state.activeProjectId === projectId ? [] : state.assets,
        pendingAssets: [],
        notice: "项目已删除。"
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "无法删除项目。" });
    }
  },
  async shareProject(projectId) {
    try {
      const result = await parseJson(
        await fetch(`/api/projects/${projectId}/share`, { method: "POST" }),
        z.object({ url: z.string().url() })
      );
      await navigator.clipboard.writeText(result.url).catch(() => undefined);
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === projectId ? { ...project, shared: true } : project
        ),
        notice: `分享链接已复制：${result.url}`
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "无法分享项目。" });
    }
  },
  async openProject(projectId) {
    if (get().isStreaming) {
      get().stopGenerating();
    }
    set({
      activeProjectId: projectId,
      activeConversationId: null,
      messages: [],
      pendingAssets: [],
      draft: "",
      sidebarOpen: false,
      error: null
    });
    await get().loadAssets(projectId);
  },
  async loadAssets(projectId = get().activeProjectId) {
    try {
      const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
      const response = await fetch(`/api/files${query}`);
      set({ assets: await parseJson(response, z.array(assetSchema)) });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "无法载入文件。" });
    }
  },
  async uploadFiles(files) {
    set({ uploading: true, error: null });
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("file", file);
        const projectId = get().activeProjectId;
        if (projectId) {
          body.append("projectId", projectId);
        }
        const asset = await parseJson(
          await fetch("/api/files", { method: "POST", body }),
          assetSchema
        );
        set((state) => ({
          assets: [asset, ...state.assets.filter((entry) => entry.id !== asset.id)],
          pendingAssets: [...state.pendingAssets, asset]
        }));
      }
      await get().loadProjects();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "无法上传文件。" });
    } finally {
      set({ uploading: false });
    }
  },
  attachAsset(asset) {
    set((state) => ({
      pendingAssets: state.pendingAssets.some((entry) => entry.id === asset.id)
        ? state.pendingAssets
        : [...state.pendingAssets, asset]
    }));
  },
  removePendingAsset(assetId) {
    set((state) => ({ pendingAssets: state.pendingAssets.filter((asset) => asset.id !== assetId) }));
  },
  startNewConversation(keepProject = false) {
    if (get().isStreaming) {
      get().stopGenerating();
    }
    set({
      activeConversationId: null,
      activeProjectId: keepProject ? get().activeProjectId : null,
      messages: [],
      assets: keepProject ? get().assets : [],
      pendingAssets: [],
      draft: "",
      error: null,
      sidebarOpen: false
    });
  },
  async openConversation(conversationId) {
    set({ loadingConversation: true, error: null });
    try {
      const conversation: ConversationDetail = await parseJson(
        await fetch(`/api/conversations/${conversationId}`),
        detailSchema
      );
      set({
        activeConversationId: conversation.id,
        activeProjectId: conversation.projectId,
        selectedModel: conversation.modelId,
        messages: conversation.messages,
        pendingAssets: [],
        loadingConversation: false,
        sidebarOpen: false
      });
      await get().loadAssets(conversation.projectId);
    } catch (error) {
      set({
        loadingConversation: false,
        error: error instanceof Error ? error.message : "无法打开对话。"
      });
    }
  },
  async selectModel(modelId) {
    set({ selectedModel: modelId });
    const conversationId = get().activeConversationId;
    if (!conversationId) {
      return;
    }
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId })
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      set((state) => ({
        conversations: state.conversations.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, modelId } : conversation
        )
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "无法切换模型。" });
    }
  },
  async renameConversation(conversationId, title) {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      set((state) => ({
        conversations: state.conversations.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, title } : conversation
        )
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "无法重命名对话。" });
    }
  },
  async deleteConversation(conversationId) {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      set((state) => ({
        conversations: state.conversations.filter((conversation) => conversation.id !== conversationId),
        activeConversationId:
          state.activeConversationId === conversationId ? null : state.activeConversationId,
        messages: state.activeConversationId === conversationId ? [] : state.messages
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "无法删除对话。" });
    }
  },
  async deleteMessage(messageId) {
    const conversationId = get().activeConversationId;
    if (!conversationId || messageId.startsWith("temporary-")) {
      return false;
    }
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages/${messageId}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      set((state) => ({ messages: state.messages.filter((message) => message.id !== messageId) }));
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "无法删除消息。" });
      return false;
    }
  },
  async sendMessage(content = get().draft) {
    const trimmed = content.trim();
    const attachments = get().pendingAssets;
    if ((!trimmed && attachments.length === 0) || get().isStreaming) {
      return;
    }
    let conversationId = get().activeConversationId;
    try {
      if (!conversationId) {
        const title = trimmed || attachments[0]?.fileName || "新对话";
        const conversation = await parseJson(
          await fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: title.slice(0, 42),
              modelId: get().selectedModel,
              projectId: get().activeProjectId
            })
          }),
          summarySchema
        );
        conversationId = conversation.id;
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: conversation.id
        }));
      }
      const userMessage = temporaryMessage(conversationId, "USER", trimmed, attachments);
      set((state) => ({
        draft: "",
        pendingAssets: [],
        messages: [...state.messages, userMessage]
      }));
      await streamReply(set, get, conversationId, trimmed, attachments.map((asset) => asset.id), true);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "无法发送消息。" });
    }
  },
  async regenerateLastResponse() {
    const state = get();
    if (!state.activeConversationId || state.isStreaming) {
      return;
    }
    const assistant = [...state.messages].reverse().find((message) => message.role === "ASSISTANT");
    const user = [...state.messages].reverse().find((message) => message.role === "USER");
    if (!assistant || !user || assistant.id.startsWith("temporary-")) {
      return;
    }
    if (!(await get().deleteMessage(assistant.id))) {
      return;
    }
    await streamReply(set, get, state.activeConversationId, user.content, [], false);
  },
  stopGenerating() {
    get().abortController?.abort();
    set({ isStreaming: false, abortController: null });
  }
}));
