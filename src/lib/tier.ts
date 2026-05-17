import { prisma } from "@/lib/prisma";
import {
  TIER_RANK,
  TOPUP_THRESHOLDS,
  type Tier,
  type PaidPlan,
} from "@/lib/tier-config";

// Re-export constants + types để các route hiện tại không phải đổi import.
export {
  TIER_RANK,
  TIER_LABEL,
  PLAN_PRICES,
  PERIOD_DAYS,
  PERIOD_LABEL,
  PERIOD_DISCOUNT_LABEL,
  TOPUP_THRESHOLDS,
  tierDiscountField,
} from "@/lib/tier-config";

export type { Tier, PaidPlan, Period } from "@/lib/tier-config";

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
