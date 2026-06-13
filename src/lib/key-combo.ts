// Combo định tuyến — alias 1 "model" gọi nhưng auto-failover qua N member.
// Dùng ở /api/v1/* (resolve khi client gọi body.model = combo.name) và CRUD UI.

import { prisma } from "@/lib/prisma";

export const COMBO_STRATEGIES = ["FAILOVER", "ROUND_ROBIN", "CHEAPEST"] as const;
export type ComboStrategy = (typeof COMBO_STRATEGIES)[number];

export const MAX_COMBO_MEMBERS = 20;
export const MAX_COMBO_NAME_LEN = 64;

// Tên combo: 1-64 ký tự, chữ/số/./_/- (giống quy ước slug model).
const COMBO_NAME_RE = /^[A-Za-z0-9._-]{1,64}$/;

export function isValidComboName(name: string): boolean {
  return COMBO_NAME_RE.test(name);
}

export function normalizeStrategy(s: unknown): ComboStrategy {
  return COMBO_STRATEGIES.includes(s as ComboStrategy) ? (s as ComboStrategy) : "FAILOVER";
}

export type ResolvedCombo = {
  id: string;
  strategy: ComboStrategy;
  rrCursor: number;
  memberSlugs: string[]; // theo thứ tự order asc
};

// Tìm combo đang bật theo (apiKeyId, name). Null nếu không phải combo.
export async function resolveCombo(apiKeyId: string, name: string): Promise<ResolvedCombo | null> {
  const combo = await prisma.keyCombo.findFirst({
    where: { apiKeyId, name, enabled: true },
    include: { members: { orderBy: { order: "asc" } } },
  });
  if (!combo || combo.members.length === 0) return null;
  return {
    id: combo.id,
    strategy: normalizeStrategy(combo.strategy),
    rrCursor: combo.rrCursor,
    memberSlugs: combo.members.map((m) => m.modelSlug),
  };
}

// Sắp xếp thứ tự thử member theo strategy.
// - FAILOVER: giữ nguyên thứ tự order.
// - ROUND_ROBIN: xoay danh sách bắt đầu từ rrCursor % n.
// - CHEAPEST: sort theo giá input tăng dần (priceBySlug truyền từ caller — đã load model row).
export function orderMembersByStrategy(
  slugs: string[],
  strategy: ComboStrategy,
  rrCursor: number,
  priceBySlug?: Map<string, number>,
): string[] {
  if (slugs.length <= 1) return slugs;
  switch (strategy) {
    case "ROUND_ROBIN": {
      const start = ((rrCursor % slugs.length) + slugs.length) % slugs.length;
      return [...slugs.slice(start), ...slugs.slice(0, start)];
    }
    case "CHEAPEST": {
      if (!priceBySlug) return slugs;
      return [...slugs].sort(
        (a, b) => (priceBySlug.get(a) ?? Infinity) - (priceBySlug.get(b) ?? Infinity),
      );
    }
    case "FAILOVER":
    default:
      return slugs;
  }
}

// Advance con trỏ ROUND_ROBIN (best-effort, race không nghiêm trọng).
export async function advanceComboCursor(comboId: string): Promise<void> {
  await prisma.keyCombo
    .update({ where: { id: comboId }, data: { rrCursor: { increment: 1 } } })
    .catch(() => undefined);
}
