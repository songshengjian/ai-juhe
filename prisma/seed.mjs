import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function configuredValue(value) {
  const normalized = value?.trim();
  if (!normalized || normalized.startsWith("REPLACE_WITH_")) {
    return null;
  }
  return normalized;
}

function configuredBaseUrl(value, fallback = null) {
  return (configuredValue(value) ?? fallback)?.replace(/\/+$/, "") ?? null;
}

const mimoBaseUrl = configuredBaseUrl(
  process.env.MIMO_BASE_URL,
  "https://token-plan-cn.xiaomimimo.com/v1"
);
const volcengineBaseUrl = configuredBaseUrl(
  process.env.VOLCENGINE_BASE_URL ?? process.env.ARK_BASE_URL,
  "https://ark.cn-beijing.volces.com/api/v3"
);
const agnesBaseUrl = configuredBaseUrl(
  process.env.AGNES_BASE_URL,
  "https://apihub.agnes-ai.com/v1"
);

const models = [
  {
    id: "mimo-v2.5",
    label: "MiMo-V2.5",
    apiModel: configuredValue(process.env.MIMO_MODEL) ?? "mimo-v2.5",
    baseUrl: mimoBaseUrl,
    apiKeyEnvName: "MIMO_API_KEY"
  },
  {
    id: "mimo-v2.5-pro",
    label: "MiMo-V2.5-Pro",
    apiModel: configuredValue(process.env.MIMO_PRO_MODEL) ?? "mimo-v2.5-pro",
    baseUrl: mimoBaseUrl,
    apiKeyEnvName: "MIMO_API_KEY"
  },
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek-V4-pro",
    apiModel:
      configuredValue(process.env.VOLCENGINE_DEEPSEEK_V4_PRO_ENDPOINT) ??
      configuredValue(process.env.VOLCENGINE_DEEPSEEK_V4_PRO_MODEL) ??
      "ep-20260530114309-cwlh4",
    baseUrl: volcengineBaseUrl,
    apiKeyEnvName: "VOLCENGINE_API_KEY"
  },
  {
    id: "agnes-video-v2.0",
    label: "Agnes Video V2.0",
    apiModel: configuredValue(process.env.AGNES_VIDEO_MODEL) ?? "agnes-video-v2.0",
    baseUrl: agnesBaseUrl,
    apiKeyEnvName: "AGNES_API_KEY"
  }
];

async function main() {
  await prisma.modelConfig.deleteMany({
    where: {
      id: {
        notIn: models.map((model) => model.id)
      }
    }
  });

  for (const model of models) {
    await prisma.modelConfig.upsert({
      where: { id: model.id },
      update: model,
      create: model
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
