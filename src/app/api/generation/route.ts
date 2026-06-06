import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserId } from "@/lib/auth";

export const runtime = "nodejs";

const creationTypeSchema = z.enum(["agent", "image", "video", "avatar", "voice", "motion"]);
const requestSchema = z.object({
  type: creationTypeSchema,
  prompt: z.string().trim().min(1).max(12000),
  ratio: z.string().trim().default("16:9"),
  resolution: z.enum(["2K", "4K"]).default("2K"),
  duration: z.string().trim().default("5s"),
  outputCount: z.coerce.number().int().min(1).max(4).default(1),
  model: z.string().trim().optional()
});
const taskPollSchema = z.object({
  type: creationTypeSchema.default("video"),
  taskId: z.string().trim().min(1),
  model: z.string().trim().optional()
});

type CreationType = z.infer<typeof creationTypeSchema>;

interface GenerationResult {
  status: "completed" | "submitted";
  model: string;
  outputUrls: string[];
  resultText?: string;
  taskId?: string;
}

function configuredValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized.startsWith("REPLACE_WITH_")) {
    return undefined;
  }
  return normalized;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function arkBaseUrl(): string {
  return trimTrailingSlash(
    configuredValue(process.env.VOLCENGINE_BASE_URL) ??
      configuredValue(process.env.ARK_BASE_URL) ??
      "https://ark.cn-beijing.volces.com/api/v3"
  );
}

function arkApiKey(model?: string): string | undefined {
  const normalizedModel = model?.trim();
  if (normalizedModel === "Doubao-Seedream-4.0" || /doubao-seedream-4-0/i.test(normalizedModel ?? "")) {
    return configuredValue(process.env.VOLCENGINE_SEEDREAM_4_0_API_KEY) ??
      configuredValue(process.env.VOLCENGINE_API_KEY) ??
      configuredValue(process.env.ARK_API_KEY);
  }
  if (normalizedModel === "Doubao-Seedream-4.5" || /doubao-seedream-4-5/i.test(normalizedModel ?? "")) {
    return configuredValue(process.env.VOLCENGINE_SEEDREAM_4_5_API_KEY) ??
      configuredValue(process.env.VOLCENGINE_API_KEY) ??
      configuredValue(process.env.ARK_API_KEY);
  }
  return configuredValue(process.env.VOLCENGINE_API_KEY) ?? configuredValue(process.env.ARK_API_KEY);
}

function resolveArkModel(model: string): string {
  const aliases: Record<string, string | undefined> = {
    "Doubao-Seedream-5.0-lite":
      configuredValue(process.env.VOLCENGINE_IMAGE_API_MODEL) ??
      "doubao-seedream-5-0-260128",
    "Doubao-Seedream-4.5":
      configuredValue(process.env.VOLCENGINE_SEEDREAM_4_5_API_MODEL) ??
      configuredValue(process.env.VOLCENGINE_SEEDREAM_4_5_ENDPOINT) ??
      "doubao-seedream-4-5-251128",
    "Doubao-Seedream-4.0":
      configuredValue(process.env.VOLCENGINE_SEEDREAM_4_0_API_MODEL) ??
      configuredValue(process.env.VOLCENGINE_SEEDREAM_4_0_ENDPOINT) ??
      "doubao-seedream-4-0-250828",
    "Seedance 1.0 Fast":
      configuredValue(process.env.VOLCENGINE_VIDEO_CONTENT_MODEL) ??
      configuredValue(process.env.VOLCENGINE_VIDEO_API_MODEL) ??
      configuredValue(process.env.VOLCENGINE_VIDEO_ENDPOINT) ??
      "doubao-seedance-1-0-lite-i2v-250428",
    "Doubao-Seed-2.0-pro":
      configuredValue(process.env.VOLCENGINE_VIDEO_CONTENT_MODEL) ??
      configuredValue(process.env.VOLCENGINE_VIDEO_API_MODEL) ??
      configuredValue(process.env.VOLCENGINE_VIDEO_ENDPOINT) ??
      "doubao-seedance-1-0-lite-i2v-250428",
    "Doubao-Seed-2.0-lite":
      configuredValue(process.env.VOLCENGINE_AGENT_API_MODEL) ??
      configuredValue(process.env.VOLCENGINE_AGENT_ENDPOINT) ??
      "doubao-seed-2-0-lite-260428",
    "Doubao-Seed-2.0-mini":
      configuredValue(process.env.VOLCENGINE_AUDIO_API_MODEL) ??
      configuredValue(process.env.VOLCENGINE_AUDIO_ENDPOINT) ??
      "doubao-seed-2-0-mini-260428",
    "Doubao-Seed-2.0-Code":
      configuredValue(process.env.VOLCENGINE_CODE_API_MODEL) ??
      configuredValue(process.env.VOLCENGINE_CODE_ENDPOINT) ??
      "doubao-seed-2-0-code"
  };
  return aliases[model] ?? model;
}

function isUnsupportedVideoGenerationModel(model: string): boolean {
  const normalized = model.toLowerCase().replace(/\./g, "-");
  return normalized.includes("doubao-seed-2-0") || normalized.includes("doubao-seed-2");
}

function firstUsableVideoContentModel(...values: Array<string | undefined>): string | undefined {
  return values
    .map(configuredValue)
    .find((value): value is string => Boolean(value && !isUnsupportedVideoGenerationModel(value)));
}

function fallbackSeedanceModel(hasReferenceMedia: boolean): string {
  return firstUsableVideoContentModel(
    process.env.VOLCENGINE_VIDEO_CONTENT_MODEL,
    process.env.VOLCENGINE_VIDEO_API_MODEL,
    process.env.VOLCENGINE_VIDEO_ENDPOINT,
    process.env.VOLCENGINE_SEEDANCE_API_MODEL,
    hasReferenceMedia ? process.env.VOLCENGINE_VIDEO_I2V_MODEL : process.env.VOLCENGINE_VIDEO_T2V_MODEL
  ) ?? (hasReferenceMedia ? "doubao-seedance-1-0-lite-i2v-250428" : "doubao-seedance-1-0-lite-t2v-250428");
}

function resolveVideoGenerationModel(model: string, files: File[]): string {
  const hasReferenceMedia = files.some((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
  const requested = configuredValue(model);
  if (!requested || isUnsupportedVideoGenerationModel(requested)) {
    return fallbackSeedanceModel(hasReferenceMedia);
  }
  if (requested === "Seedance 1.0 Fast") {
    return fallbackSeedanceModel(hasReferenceMedia);
  }
  const resolved = resolveArkModel(requested);
  if (isUnsupportedVideoGenerationModel(resolved)) {
    return fallbackSeedanceModel(hasReferenceMedia);
  }
  return firstUsableVideoContentModel(resolved) ?? fallbackSeedanceModel(hasReferenceMedia);
}

function displayVideoModel(model: string): string {
  if (isUnsupportedVideoGenerationModel(model) || model.startsWith("ep-") || /doubao-seedance/i.test(model)) {
    const configuredDisplayModel = configuredValue(process.env.VOLCENGINE_VIDEO_MODEL);
    return configuredDisplayModel && !isUnsupportedVideoGenerationModel(configuredDisplayModel)
      ? configuredDisplayModel
      : "Seedance 1.0 Fast";
  }
  return model;
}

function modelForType(type: CreationType, requestedModel?: string): string {
  const requested = configuredValue(requestedModel);
  if (requested) {
    return requested;
  }
  if (type === "image") {
    return configuredValue(process.env.VOLCENGINE_IMAGE_MODEL) ?? "Doubao-Seedream-5.0-lite";
  }
  if (type === "video" || type === "motion" || type === "avatar") {
    const configuredVideoModel = configuredValue(process.env.VOLCENGINE_VIDEO_MODEL);
    return configuredVideoModel && !isUnsupportedVideoGenerationModel(configuredVideoModel)
      ? configuredVideoModel
      : "Seedance 1.0 Fast";
  }
  if (type === "voice") {
    return configuredValue(process.env.VOLCENGINE_AUDIO_MODEL) ?? "Doubao-Seed-2.0-mini";
  }
  return configuredValue(process.env.VOLCENGINE_AGENT_MODEL) ?? "Doubao-Seed-2.0-lite";
}

function getString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function durationSeconds(duration: string): number {
  const match = /(\d+)/.exec(duration);
  const value = match ? Number(match[1]) : 5;
  return Number.isFinite(value) ? Math.min(15, Math.max(1, value)) : 5;
}

function imageSizeForRatio(ratio: string, resolution: "2K" | "4K"): string {
  const longEdge = resolution === "4K" ? 3840 : 2560;
  const shortEdge = resolution === "4K" ? 2160 : 1440;
  const normalizedRatio = ratio === "auto" ? "16:9" : ratio;

  switch (normalizedRatio) {
    case "21:9":
      return `${longEdge}x${Math.round((longEdge / 21) * 9)}`;
    case "3:2":
      return `${Math.round((shortEdge / 2) * 3)}x${shortEdge}`;
    case "4:3":
      return `${Math.round((shortEdge / 3) * 4)}x${shortEdge}`;
    case "1:1":
      return `${shortEdge}x${shortEdge}`;
    case "3:4":
      return `${shortEdge}x${Math.round((shortEdge / 3) * 4)}`;
    case "2:3":
      return `${shortEdge}x${Math.round((shortEdge / 2) * 3)}`;
    case "9:16":
      return `${shortEdge}x${longEdge}`;
    case "16:9":
    default:
      return `${longEdge}x${shortEdge}`;
  }
}

function imageSizeForModel(model: string, ratio: string, resolution: "2K" | "4K"): string {
  if (model === "Doubao-Seedream-4.0" || model === "Doubao-Seedream-4.5") {
    return resolution;
  }
  return imageSizeForRatio(ratio, resolution);
}

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type || "application/octet-stream"};base64,${buffer.toString("base64")}`;
}

async function readFileSummaries(files: File[]): Promise<string> {
  if (files.length === 0) {
    return "";
  }
  return files
    .map((file, index) => `Reference ${index + 1}: ${file.name} (${file.type || "application/octet-stream"})`)
    .join("\n");
}

function parseImageUrls(payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null) {
    return [];
  }
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const candidate = item as { url?: unknown; b64_json?: unknown };
      if (typeof candidate.url === "string") {
        return candidate.url;
      }
      if (typeof candidate.b64_json === "string") {
        return `data:image/png;base64,${candidate.b64_json}`;
      }
      return null;
    })
    .filter((url): url is string => Boolean(url));
}

function findStringByKeys(value: unknown, keys: string[]): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKeys(item, keys);
      if (found) {
        return found;
      }
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }
  for (const child of Object.values(record)) {
    const found = findStringByKeys(child, keys);
    if (found) {
      return found;
    }
  }
  return null;
}

function findVideoUrls(payload: unknown): string[] {
  const keys = ["video_url", "videoUrl", "url", "download_url", "downloadUrl", "output_url"];
  const url = findStringByKeys(payload, keys);
  return url ? [url] : [];
}

function responseText(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }
  const direct = (payload as { output_text?: unknown }).output_text;
  if (typeof direct === "string") {
    return direct;
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (Array.isArray(choices)) {
    const message = choices[0] as { message?: { content?: unknown } } | undefined;
    if (typeof message?.message?.content === "string") {
      return message.message.content;
    }
  }
  const text = findStringByKeys(payload, ["text", "content"]);
  return text ?? "";
}

async function postArk(path: string, body: unknown, model?: string): Promise<unknown> {
  const apiKey = arkApiKey(model);
  if (!apiKey) {
    throw new Error("VOLCENGINE_NOT_CONFIGURED");
  }
  const response = await fetch(`${arkBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`ARK_${response.status}:${detail.slice(0, 700)}`);
  }
  return response.json();
}

async function getArk(path: string): Promise<unknown> {
  const apiKey = arkApiKey();
  if (!apiKey) {
    throw new Error("VOLCENGINE_NOT_CONFIGURED");
  }
  const response = await fetch(`${arkBaseUrl()}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

async function generateImage(data: z.infer<typeof requestSchema>, files: File[]): Promise<GenerationResult> {
  const model = modelForType("image", data.model);
  const imageUrls = await Promise.all(
    files.filter((file) => file.type.startsWith("image/")).slice(0, 4).map(fileToDataUrl)
  );
  const prompt = imageUrls.length
    ? `${data.prompt}\n\nUse the uploaded reference images when useful.`
    : data.prompt;
  const body = {
    model: resolveArkModel(model),
    prompt,
    response_format: "url",
    size: imageSizeForModel(model, data.ratio, data.resolution),
    sequential_image_generation: data.outputCount > 1 ? "auto" : "disabled",
    sequential_image_generation_options: data.outputCount > 1 ? { max_images: data.outputCount } : undefined,
    watermark: false,
    output_format: "png",
    ...(imageUrls.length > 0 ? { image: imageUrls.length === 1 ? imageUrls[0] : imageUrls } : {})
  };
  const payload = await postArk("/images/generations", body, model);
  const outputUrls = parseImageUrls(payload);
  return {
    status: "completed",
    model,
    outputUrls,
    resultText: outputUrls.length > 0 ? undefined : "Image generation completed but no output URL was returned."
  };
}

async function pollVideoTask(taskId: string): Promise<{ status: "completed" | "submitted"; outputUrls: string[] }> {
  for (let index = 0; index < 6; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const payload = await getArk(`/contents/generations/tasks/${encodeURIComponent(taskId)}`);
    const outputUrls = findVideoUrls(payload);
    if (outputUrls.length > 0) {
      return { status: "completed", outputUrls };
    }
    const status = findStringByKeys(payload, ["status", "task_status"]);
    if (status && /success|succeeded|completed/i.test(status)) {
      return { status: "completed", outputUrls };
    }
  }
  return { status: "submitted", outputUrls: [] };
}

async function generateVideo(data: z.infer<typeof requestSchema>, files: File[]): Promise<GenerationResult> {
  const requestedModel = modelForType("video", data.model);
  const providerModel = resolveVideoGenerationModel(requestedModel, files);
  const model = displayVideoModel(requestedModel);
  const fileSummary = await readFileSummaries(files);
  const prompt = [
    data.prompt,
    fileSummary ? `Uploaded references:\n${fileSummary}` : "",
    `Aspect ratio: ${data.ratio}. Duration: ${durationSeconds(data.duration)} seconds.`
  ]
    .filter(Boolean)
    .join("\n\n");
  const body = {
    model: providerModel,
    content: [
      {
        type: "text",
        text: prompt
      }
    ],
    ratio: data.ratio === "auto" ? "16:9" : data.ratio,
    duration: durationSeconds(data.duration),
    watermark: false
  };
  const payload = await postArk("/contents/generations/tasks", body, providerModel);
  const taskId =
    findStringByKeys(payload, ["id", "task_id", "taskId"]) ?? findStringByKeys(payload, ["request_id", "requestId"]);
  const immediateUrls = findVideoUrls(payload);
  if (!taskId || immediateUrls.length > 0) {
    return {
      status: immediateUrls.length > 0 ? "completed" : "submitted",
      model,
      outputUrls: immediateUrls,
      taskId: taskId ?? undefined
    };
  }
  const polled = await pollVideoTask(taskId);
  return {
    status: polled.status,
    model,
    outputUrls: polled.outputUrls,
    taskId
  };
}

async function runOmni(data: z.infer<typeof requestSchema>, files: File[]): Promise<GenerationResult> {
  const model = modelForType(data.type === "voice" ? "voice" : "agent", data.model);
  const imageParts = await Promise.all(
    files.filter((file) => file.type.startsWith("image/")).slice(0, 4).map(async (file) => ({
      type: "input_image",
      image_url: await fileToDataUrl(file)
    }))
  );
  const fileSummary = await readFileSummaries(files.filter((file) => !file.type.startsWith("image/")));
  const taskHint =
    data.type === "voice"
      ? "Create or analyze audio content for the user's request. Return practical output in text if audio synthesis is unavailable."
      : "Plan and complete the cross-modal creative task using text, image, audio, and video understanding when references are supplied.";
  const payload = await postArk("/responses", {
    model: resolveArkModel(model),
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: taskHint }]
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: fileSummary ? `${data.prompt}\n\n${fileSummary}` : data.prompt },
          ...imageParts
        ]
      }
    ]
  }, model);
  return {
    status: "completed",
    model,
    outputUrls: [],
    resultText: responseText(payload) || "The multimodal model returned an empty text result."
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid generation request." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse({
    type: getString(formData, "type"),
    prompt: getString(formData, "prompt"),
    ratio: getString(formData, "ratio") ?? "16:9",
    resolution: getString(formData, "resolution") ?? "2K",
    duration: getString(formData, "duration") ?? "5s",
    outputCount: getString(formData, "outputCount") ?? "1",
    model: getString(formData, "model")
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid generation request." }, { status: 400 });
  }

  const files = formData.getAll("files").filter((value): value is File => value instanceof File);

  try {
    let result: GenerationResult;
    if (parsed.data.type === "image") {
      result = await generateImage(parsed.data, files);
    } else if (parsed.data.type === "video" || parsed.data.type === "motion" || parsed.data.type === "avatar") {
      result = await generateVideo(parsed.data, files);
    } else {
      result = await runOmni(parsed.data, files);
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("generation provider error", error);
    const message =
      error instanceof Error && error.message.startsWith("ARK_")
        ? `Volcengine generation API returned an error: ${error.message.slice(0, 320)}`
        : "Unable to connect to the generation provider.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = taskPollSchema.safeParse({
    type: url.searchParams.get("type") ?? "video",
    taskId: url.searchParams.get("taskId"),
    model: url.searchParams.get("model") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid generation task." }, { status: 400 });
  }

  if (!["video", "motion", "avatar"].includes(parsed.data.type)) {
    return NextResponse.json({ error: "Only video generation tasks can be polled." }, { status: 400 });
  }

  try {
    const model = modelForType(parsed.data.type, parsed.data.model);
    const result = await pollVideoTask(parsed.data.taskId);
    return NextResponse.json({
      ...result,
      model,
      taskId: parsed.data.taskId
    });
  } catch (error) {
    console.error("generation task poll error", error);
    const message =
      error instanceof Error && error.message.startsWith("ARK_")
        ? `Volcengine generation API returned an error: ${error.message.slice(0, 320)}`
        : "Unable to check the generation task.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
