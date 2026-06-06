import type { Asset, Project } from "@prisma/client";

import type { AssetSummary, ProjectSummary } from "@/types";

export function toProjectSummary(
  project: Pick<Project, "id" | "name" | "shareToken" | "updatedAt">
): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    shared: Boolean(project.shareToken),
    updatedAt: project.updatedAt.toISOString()
  };
}

export function toAssetSummary(
  asset: Pick<
    Asset,
    "id" | "fileName" | "mimeType" | "sizeBytes" | "projectId" | "createdAt" | "extractedText" | "parseError"
  >
): AssetSummary {
  return {
    id: asset.id,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    projectId: asset.projectId,
    createdAt: asset.createdAt.toISOString(),
    contentUrl: `/api/files/${asset.id}/content`,
    textExtracted: Boolean(asset.extractedText),
    parseError: asset.parseError
  };
}
