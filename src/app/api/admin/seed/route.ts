import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function configuredValue(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized || normalized.startsWith("REPLACE_WITH_")) {
    return null;
  }
  return normalized;
}

function configuredBaseUrl(value: string | null | undefined, fallback: string | null = null) {
  return (configuredValue(value) ?? fallback)?.replace(/\/+$/, "") ?? null;
}

export async function POST(request: NextRequest) {
  try {
    // 验证授权（简单验证，生产环境应该加强）
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        apiKeyEnvName: "MIMO_API_KEY",
        enabled: true
      },
      {
        id: "mimo-v2.5-pro",
        label: "MiMo-V2.5-Pro",
        apiModel: configuredValue(process.env.MIMO_PRO_MODEL) ?? "mimo-v2.5-pro",
        baseUrl: mimoBaseUrl,
        apiKeyEnvName: "MIMO_API_KEY",
        enabled: true
      },
      {
        id: "deepseek-v4-pro",
        label: "DeepSeek-V4-pro",
        apiModel:
          configuredValue(process.env.VOLCENGINE_DEEPSEEK_V4_PRO_ENDPOINT) ??
          configuredValue(process.env.VOLCENGINE_DEEPSEEK_V4_PRO_MODEL) ??
          "ep-20260530114309-cwlh4",
        baseUrl: volcengineBaseUrl,
        apiKeyEnvName: "VOLCENGINE_API_KEY",
        enabled: true
      },
      {
        id: "agnes-2.0-flash",
        label: "Agnes Text Flash",
        apiModel: configuredValue(process.env.AGNES_TEXT_MODEL) ?? "agnes-2.0-flash",
        baseUrl: agnesBaseUrl,
        apiKeyEnvName: "AGNES_API_KEY",
        enabled: true
      },
      {
        id: "agnes-image-2.1-flash",
        label: "Agnes Image V2.1",
        apiModel: configuredValue(process.env.AGNES_IMAGE_MODEL) ?? "agnes-image-2.1-flash",
        baseUrl: agnesBaseUrl,
        apiKeyEnvName: "AGNES_API_KEY",
        enabled: true
      },
      {
        id: "agnes-video-v2.0",
        label: "Agnes Video V2.0",
        apiModel: configuredValue(process.env.AGNES_VIDEO_MODEL) ?? "agnes-video-v2.0",
        baseUrl: agnesBaseUrl,
        apiKeyEnvName: "AGNES_API_KEY",
        enabled: true
      }
    ];

    // 删除不存在的模型
    await prisma.modelConfig.deleteMany({
      where: {
        id: {
          notIn: models.map((model) => model.id)
        }
      }
    });

    // 插入或更新模型
    for (const model of models) {
      await prisma.modelConfig.upsert({
        where: { id: model.id },
        update: model,
        create: model
      });
    }

    return NextResponse.json({
      success: true,
      message: "Models seeded successfully",
      count: models.length
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed models", detail: String(error) },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
