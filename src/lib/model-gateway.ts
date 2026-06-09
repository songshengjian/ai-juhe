import { z } from "zod";

import { readUpload } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";
import { MODEL_IDS, type ModelId } from "@/types";

export const modelIdSchema = z.enum(MODEL_IDS);

export interface ProviderTextPart {
  type: "text";
  text: string;
}

export interface ProviderImagePart {
  type: "image_url";
  image_url: {
    url: string;
  };
}

export type ProviderContent = string | Array<ProviderTextPart | ProviderImagePart>;

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: ProviderContent;
}

interface ModelDefinition {
  id: ModelId;
  label: string;
  baseUrl: string | undefined;
  apiKey: string | undefined;
  apiModel: string;
  includeUsageStream?: boolean;
}

interface AttachmentAsset {
  fileName: string;
  storedName: string;
  mimeType: string;
  extractedText: string | null;
}

interface TextAsset {
  fileName: string;
  mimeType: string;
  extractedText: string | null;
}

const providerTextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string()
});

const providerImagePartSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.object({
    url: z.string()
  })
});

const contextSchema = z.array(
  z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.union([z.string(), z.array(z.union([providerTextPartSchema, providerImagePartSchema]))])
  })
);

const MAX_DOCUMENT_CONTEXT = 60_000;
const MAX_IMAGES_PER_MESSAGE = 4;

function attachmentContext(assets: TextAsset[]): string {
  return assets
    .map((asset) => {
      const body = asset.extractedText?.trim();
      return body ? `File: ${asset.fileName} (${asset.mimeType})\n${body}` : "";
    })
    .filter(Boolean)
    .join("\n\n---\n\n")
    .slice(0, MAX_DOCUMENT_CONTEXT);
}

function trimTrailingSlash(url: string | undefined): string | undefined {
  return url?.replace(/\/+$/, "");
}

function configuredValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized.startsWith("REPLACE_WITH_")) {
    return undefined;
  }
  return normalized;
}

function configuredBaseUrl(value: string | undefined, fallback?: string): string | undefined {
  return trimTrailingSlash(configuredValue(value) ?? fallback);
}

function volcengineApiKey(): string | undefined {
  return configuredValue(process.env.VOLCENGINE_API_KEY) ?? configuredValue(process.env.ARK_API_KEY);
}

function volcengineBaseUrl(): string | undefined {
  return configuredBaseUrl(
    process.env.VOLCENGINE_BASE_URL ?? process.env.ARK_BASE_URL,
    "https://ark.cn-beijing.volces.com/api/v3"
  );
}

function agnesApiKey(): string | undefined {
  return configuredValue(process.env.AGNES_API_KEY);
}

function agnesBaseUrl(): string | undefined {
  return configuredBaseUrl(
    process.env.AGNES_BASE_URL,
    "https://apihub.agnes-ai.com/v1"
  );
}

export function getModelDefinition(id: ModelId): ModelDefinition {
  const definitions: Record<ModelId, ModelDefinition> = {
    "mimo-v2.5": {
      id: "mimo-v2.5",
      label: "MiMo-V2.5",
      baseUrl: configuredBaseUrl(process.env.MIMO_BASE_URL, "https://token-plan-cn.xiaomimimo.com/v1"),
      apiKey: configuredValue(process.env.MIMO_API_KEY),
      apiModel: configuredValue(process.env.MIMO_MODEL) ?? "mimo-v2.5",
      includeUsageStream: true
    },
    "mimo-v2.5-pro": {
      id: "mimo-v2.5-pro",
      label: "MiMo-V2.5-Pro",
      baseUrl: configuredBaseUrl(process.env.MIMO_BASE_URL, "https://token-plan-cn.xiaomimimo.com/v1"),
      apiKey: configuredValue(process.env.MIMO_API_KEY),
      apiModel: configuredValue(process.env.MIMO_PRO_MODEL) ?? "mimo-v2.5-pro",
      includeUsageStream: true
    },
    "deepseek-v4-pro": {
      id: "deepseek-v4-pro",
      label: "DeepSeek-V4-pro",
      baseUrl: volcengineBaseUrl(),
      apiKey: volcengineApiKey(),
      apiModel:
        configuredValue(process.env.VOLCENGINE_DEEPSEEK_V4_PRO_ENDPOINT) ??
        configuredValue(process.env.VOLCENGINE_DEEPSEEK_V4_PRO_MODEL) ??
        "ep-20260530114309-cwlh4"
    },
    "agnes-2.0-flash": {
      id: "agnes-2.0-flash",
      label: "Agnes Text Flash",
      baseUrl: agnesBaseUrl(),
      apiKey: agnesApiKey(),
      apiModel: configuredValue(process.env.AGNES_TEXT_MODEL) ?? "agnes-2.0-flash",
      includeUsageStream: true
    },
    "agnes-image-2.1-flash": {
      id: "agnes-image-2.1-flash",
      label: "Agnes Image V2.1",
      baseUrl: agnesBaseUrl(),
      apiKey: agnesApiKey(),
      apiModel: configuredValue(process.env.AGNES_IMAGE_MODEL) ?? "agnes-image-2.1-flash"
    },
    "agnes-video-v2.0": {
      id: "agnes-video-v2.0",
      label: "Agnes Video V2.0",
      baseUrl: agnesBaseUrl(),
      apiKey: agnesApiKey(),
      apiModel: configuredValue(process.env.AGNES_VIDEO_MODEL) ?? "agnes-video-v2.0"
    }
  };
  return definitions[id];
}

function identityMessage(model: ModelDefinition): ProviderMessage {
  return {
    role: "system",
    content: [
      `You are ${model.label}.`,
      `Current API model/endpoint: ${model.apiModel}.`,
      "When the user asks what model you are, answer with this current model name only.",
      "Do not claim to be MiMo or any other model unless the current model name is MiMo."
    ].join("\n")
  };
}

export class ProviderConfigurationError extends Error {
  constructor(label: string) {
    super(`${label} is not configured on the server.`);
    this.name = "ProviderConfigurationError";
  }
}

function isImageAsset(asset: Pick<AttachmentAsset, "mimeType">): boolean {
  return asset.mimeType.toLowerCase().startsWith("image/");
}

function hasImageContent(messages: ProviderMessage[]): boolean {
  return messages.some(
    (message) =>
      Array.isArray(message.content) &&
      message.content.some((part) => part.type === "image_url")
  );
}

async function toImagePart(asset: AttachmentAsset): Promise<ProviderImagePart | null> {
  try {
    const bytes = await readUpload(asset.storedName);
    return {
      type: "image_url",
      image_url: {
        url: `data:${asset.mimeType};base64,${bytes.toString("base64")}`
      }
    };
  } catch {
    return null;
  }
}

async function buildUserContent(content: string, assets: AttachmentAsset[]): Promise<ProviderContent> {
  const documentContext = attachmentContext(assets.filter((asset) => !isImageAsset(asset)));
  const imageParts = (
    await Promise.all(assets.filter(isImageAsset).slice(0, MAX_IMAGES_PER_MESSAGE).map(toImagePart))
  ).filter((part): part is ProviderImagePart => part !== null);
  const text = documentContext
    ? `${content || "Please use the attached files as context."}\n\nAttached file text:\n${documentContext}`
    : content || (imageParts.length > 0 ? "Please inspect these images and answer the user." : "");

  if (imageParts.length === 0) {
    return text;
  }

  return [{ type: "text", text }, ...imageParts];
}

export async function getConversationContext(conversationId: string): Promise<ProviderMessage[]> {
  const redis = await getRedisClient();
  const cacheKey = `conversation:${conversationId}:context`;
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        try {
          const parsed: unknown = JSON.parse(cached);
          const result = contextSchema.safeParse(parsed);
          if (result.success) {
            return result.data;
          }
        } catch {
          await redis.del(cacheKey);
        }
      }
    } catch {
      await redis.disconnect().catch(() => undefined);
    }
  }

  const records = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      role: true,
      content: true,
      attachments: {
        select: {
          asset: {
            select: {
              fileName: true,
              storedName: true,
              mimeType: true,
              extractedText: true
            }
          }
        }
      }
    }
  });
  const projectAssets = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      project: {
        select: {
          assets: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { fileName: true, mimeType: true, extractedText: true }
          }
        }
      }
    }
  });

  const messages = await Promise.all(
    records.reverse().map(async (record): Promise<ProviderMessage> => ({
      role: record.role.toLowerCase() as ProviderMessage["role"],
      content:
        record.role === "USER"
          ? await buildUserContent(
              record.content,
              record.attachments.map(({ asset }) => asset)
            )
          : record.content
    }))
  );
  const projectDocumentText = projectAssets?.project?.assets.length
    ? attachmentContext(projectAssets.project.assets)
    : "";
  if (projectDocumentText) {
    messages.unshift({
      role: "system",
      content: `The current project library contains these files. Prefer them when the user asks about project materials.\n\n${projectDocumentText}`
    });
  }
  if (redis && !hasImageContent(messages)) {
    await redis.setEx(cacheKey, 300, JSON.stringify(messages)).catch(() => undefined);
  }
  return messages;
}

export async function openProviderStream(
  modelId: ModelId,
  messages: ProviderMessage[],
  signal: AbortSignal
): Promise<Response> {
  const model = getModelDefinition(modelId);
  if (!model.baseUrl || !model.apiKey) {
    throw new ProviderConfigurationError(model.label);
  }

  const body = {
    model: model.apiModel,
    messages: [identityMessage(model), ...messages],
    stream: true,
    ...(model.includeUsageStream ? { stream_options: { include_usage: true } } : {})
  };

  return fetch(`${model.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${model.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal
  });
}
