import { prisma } from "@/lib/prisma";

export type Tier = "FREE" | "BASIC" | "ADV" | "ULTRA";
export type PaidPlan = "BASIC" | "ADV";
export type Period = "MONTH" | "HALF_YEAR" | "YEAR";

export const TIER_RANK: Record<Tier, number> = { FREE: 0, BASIC: 1, ADV: 2, ULTRA: 3 };
export const TIER_LABEL: Record<Tier, string> = {
  FREE: "Free",
  BASIC: "Basic",
  ADV: "Advanced+",
  ULTRA: "Ultra",
};

export const PLAN_PRICES: Record<PaidPlan, Record<Period, number>> = {
  BASIC: {
    MONTH: 99_000,
    HALF_YEAR: Math.round(99_000 * 6 * 0.84),
    YEAR: Math.round(99_000 * 12 * 0.76),
  },
  ADV: {
    MONTH: 199_000,
    HALF_YEAR: Math.round(199_000 * 6 * 0.84),
    YEAR: Math.round(199_000 * 12 * 0.76),
  },
};

export const PERIOD_DAYS: Record<Period, number> = {
  MONTH: 30,
  HALF_YEAR: 180,
  YEAR: 365,
};

export const PERIOD_LABEL: Record<Period, string> = {
  MONTH: "1 tháng",
  HALF_YEAR: "6 tháng",
  YEAR: "1 năm",
};

export const TOPUP_THRESHOLDS: Array<[Tier, number]> = [
  ["ULTRA", 10_000_000],
  ["ADV", 5_000_000],
  ["BASIC", 2_000_000],
];

export async function computeAutoTier(userId: string): Promise<Tier> {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const sum = await prisma.topupRequest.aggregate({
    where: { userId, status: "APPROVED", processedAt: { gte: since } },
    _sum: { amount: true },
  });
  const total = sum._sum.amount ?? 0;
  for (const [tier, threshold] of TOPUP_THRESHOLDS) {
    if (total >= threshold) return tier;
  }
  return "FREE";
}

export async function topup30dTotal(userId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const sum = await prisma.topupRequest.aggregate({
    where: { userId, status: "APPROVED", processedAt: { gte: since } },
    _sum: { amount: true },
  });
  return sum._sum.amount ?? 0;
}

export async function resolveTier(userId: string) {
  const auto = await computeAutoTier(userId);
  const paidSub = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE", expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
  });
  const paidTier: Tier = (paidSub?.plan as Tier | undefined) ?? "FREE";
  const tier: Tier = TIER_RANK[auto] >= TIER_RANK[paidTier] ? auto : paidTier;
  const source: "AUTO" | "PAID" = TIER_RANK[paidTier] > TIER_RANK[auto] ? "PAID" : "AUTO";
  return {
    tier,
    source,
    auto,
    paidPlan: paidSub?.plan as PaidPlan | undefined,
    paidExpires: paidSub?.expiresAt ?? null,
    paidSubId: paidSub?.id ?? null,
  };
}

export async function syncUserTier(userId: string) {
  const r = await resolveTier(userId);
  await prisma.user.update({
    where: { id: userId },
    data: {
      tier: r.tier,
      tierSource: r.source,
      tierExpiresAt: r.paidExpires,
    },
  });
  return r;
}

export function tierDiscountField(
  tier: Tier
): "basicDiscount" | "advDiscount" | null {
  if (tier === "FREE") return null;
  if (tier === "BASIC") return "basicDiscount";
  return "advDiscount";
}
