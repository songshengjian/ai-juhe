export const MODEL_IDS = [
  "mimo-v2.5",
  "mimo-v2.5-pro",
  "deepseek-v4-pro",
  "agnes-2.0-flash",
  "agnes-image-2.1-flash",
  "agnes-video-v2.0"
] as const;

export type ModelId = (typeof MODEL_IDS)[number];
export const DEFAULT_MODEL_ID: ModelId = "mimo-v2.5";

export interface ModelOption {
  id: ModelId;
  label: string;
  provider: "Core" | "Volcengine" | "Agnes";
  description: string;
  badges: string[];
}

export const MODEL_OPTIONS: readonly ModelOption[] = [
  {
    id: "mimo-v2.5",
    label: "MiMo-V2.5",
    provider: "Core",
    description: "Text chat model.",
    badges: ["Chat", "Stable"]
  },
  {
    id: "mimo-v2.5-pro",
    label: "MiMo-V2.5-Pro",
    provider: "Core",
    description: "Text chat model.",
    badges: ["Chat", "Pro"]
  },
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek-V4-pro",
    provider: "Volcengine",
    description: "Text chat model.",
    badges: ["Coding", "Reasoning"]
  },
  {
    id: "agnes-2.0-flash",
    label: "Agnes Text Flash",
    provider: "Agnes",
    description: "Fast text chat model with 1M context.",
    badges: ["Free", "Fast"]
  },
  {
    id: "agnes-image-2.1-flash",
    label: "Agnes Image V2.1",
    provider: "Agnes",
    description: "Text to image generation.",
    badges: ["Free", "Image"]
  },
  {
    id: "agnes-video-v2.0",
    label: "Agnes Video V2.0",
    provider: "Agnes",
    description: "Text to video with audio sync.",
    badges: ["Free", "Video"]
  }
];

export type ChatRole = "USER" | "ASSISTANT" | "SYSTEM";

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  totalTokens: number | null;
  attachments: AssetSummary[];
  pending?: boolean;
  thinking?: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  modelId: ModelId;
  projectId: string | null;
  updatedAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  shared: boolean;
  updatedAt: string;
}

export interface AssetSummary {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  projectId: string | null;
  createdAt: string;
  contentUrl: string;
  textExtracted: boolean;
  parseError: string | null;
}

export type ChatStreamEvent =
  | { type: "status"; status: "thinking" | "answering" }
  | { type: "delta"; delta: string }
  | { type: "done"; messageId: string | null; totalTokens: number | null }
  | { type: "error"; error: string };

export interface ApiErrorResponse {
  error: string;
}

export type WorkspaceView = "home" | "chat" | "library" | "apps" | "audio" | "generate" | "canvas";
