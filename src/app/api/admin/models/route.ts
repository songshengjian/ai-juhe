import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const models = await prisma.modelConfig.findMany({
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({
      success: true,
      count: models.length,
      models: models.map(m => ({
        id: m.id,
        label: m.label,
        apiModel: m.apiModel,
        baseUrl: m.baseUrl,
        apiKeyEnvName: m.apiKeyEnvName,
        enabled: m.enabled
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch models", detail: String(error) },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
