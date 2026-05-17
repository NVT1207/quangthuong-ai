// Constants + types thuần (no server-only imports) — share giữa server và client.
// Đừng import prisma/server-only stuff vào file này.

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

// Giá đẹp psychological pricing — đồng bộ cả client (upgrade-client.tsx) và server (lib/tier.ts + api/subscriptions).
export const PLAN_PRICES: Record<PaidPlan, Record<Period, number>> = {
  BASIC: {
    MONTH: 99_000,
    HALF_YEAR: 499_999,
    YEAR: 899_999,
  },
  ADV: {
    MONTH: 199_000,
    HALF_YEAR: 999_999,
    YEAR: 1_799_999,
  },
};

// Phần trăm giảm so với mua MONTH x N — chỉ cho UI hiển thị.
export const PERIOD_DISCOUNT_LABEL: Record<Period, string> = {
  MONTH: "",
  HALF_YEAR: "-16%",
  YEAR: "-25%",
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

// Ngưỡng nạp 30 ngày để auto upgrade tier (không tính subscription).
export const TOPUP_THRESHOLDS: Array<[Tier, number]> = [
  ["ULTRA", 10_000_000],
  ["ADV", 5_000_000],
  ["BASIC", 2_000_000],
];

/**
 * Map tier user hiện tại → field chứa % giảm giá trong model.
 * FREE không có giảm. ULTRA hưởng advDiscount (chưa có ultraDiscount riêng).
 */
export function tierDiscountField(
  tier: Tier,
): "basicDiscount" | "advDiscount" | null {
  if (tier === "FREE") return null;
  if (tier === "BASIC") return "basicDiscount";
  return "advDiscount"; // ADV + ULTRA
}
