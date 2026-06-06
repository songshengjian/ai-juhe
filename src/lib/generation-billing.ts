export type BillableCreationType = "agent" | "image" | "video" | "avatar" | "voice" | "motion";

export interface GenerationCostInput {
  type: BillableCreationType;
  duration?: string;
  outputCount?: number;
  resolution?: "2K" | "4K";
  materialsCount?: number;
}

export interface CreditPools {
  free: number;
  subscription: number;
  recharge: number;
}

export const DAILY_FREE_CREDITS = 60;
export const STANDARD_MONTHLY_CREDITS = 2210;
export const TEST_RECHARGE_CREDITS = 10000;
export const DEFAULT_CREDIT_POOLS: CreditPools = {
  free: DAILY_FREE_CREDITS,
  subscription: STANDARD_MONTHLY_CREDITS,
  recharge: TEST_RECHARGE_CREDITS
};
export const DEFAULT_CREDITS =
  DEFAULT_CREDIT_POOLS.free + DEFAULT_CREDIT_POOLS.subscription + DEFAULT_CREDIT_POOLS.recharge;

export function parseDurationSeconds(duration?: string): number {
  const match = duration?.match(/\d+/);
  return match ? Number(match[0]) : 5;
}

function perSecondCost(duration: string | undefined, rate: number): number {
  return Math.max(1, Math.ceil(parseDurationSeconds(duration) * rate));
}

export function calculateGenerationCost({
  type,
  duration,
  resolution = "2K",
  materialsCount = 0
}: GenerationCostInput): number {
  if (type === "image") {
    const hasReference = materialsCount > 0;
    if (hasReference) {
      return resolution === "4K" ? 6 : 3;
    }
    return resolution === "4K" ? 8 : 4;
  }

  if (type === "motion") {
    return 200;
  }

  if (type === "video") {
    return perSecondCost(duration, resolution === "4K" ? 12 : 8);
  }

  if (type === "avatar") {
    return perSecondCost(duration, resolution === "4K" ? 12 : 8) + perSecondCost(duration, 50 / 15);
  }

  if (type === "voice") {
    return 10;
  }

  return 12;
}

export function formatCredits(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}
