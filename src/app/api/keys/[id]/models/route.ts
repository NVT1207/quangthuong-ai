import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureOwnedKey(userId: string, keyId: string) {
  const k = await prisma.apiKey.findUnique({ where: { id: keyId }, select: { id: true, userId: true } });
  if (!k || k.userId !== userId) return null;
  return k;
}

// GET /api/keys/[id]/models — list models đã subscribe + stats per-model
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = await ensureOwnedKey(session.user.id, params.id);
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const subs = await prisma.apiKeyModel.findMany({
    where: { apiKeyId: params.id },
    include: {
      model: {
        select: {
          id: true, slug: true, displayName: true, provider: true, category: true,
          active: true, contextLength: true, inputPrice: true, outputPrice: true, priceUnit: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Dedupe theo slug — slug giờ có thể có nhiều row (pool key), nhưng UI chỉ cần show 1 entry.
  const seenSlug = new Set<string>();
  const dedupedSubs = subs.filter((s) => {
    if (seenSlug.has(s.model.slug)) return false;
    seenSlug.add(s.model.slug);
    return true;
  });

  // Stats per-model từ UsageLog — group theo slug (vì UsageLog chỉ lưu modelSlug).
  const slugs = dedupedSubs.map((s) => s.model.slug);
  const [stats, successStats] = slugs.length
    ? await Promise.all([
        prisma.usageLog.groupBy({
          by: ["modelSlug"],
          where: { apiKeyId: params.id, modelSlug: { in: slugs } },
          _sum: { cost: true, inputTokens: true, outputTokens: true },
          _count: { _all: true },
          _max: { createdAt: true },
        }),
        prisma.usageLog.groupBy({
          by: ["modelSlug"],
          where: { apiKeyId: params.id, modelSlug: { in: slugs }, status: { gte: 200, lt: 300 } },
          _count: { _all: true },
        }),
      ])
    : [[], []];
  const statMap = new Map(stats.map((s) => [s.modelSlug, s]));
  const successMap = new Map(successStats.map((s) => [s.modelSlug, s._count._all]));

  const rows = dedupedSubs.map((s) => {
    const st = statMap.get(s.model.slug);
    return {
      id: s.id,
      modelId: s.modelId,
      enabled: s.enabled,
      createdAt: s.createdAt.toISOString(),
      model: s.model,
      stats: {
        totalRequests: st?._count._all ?? 0,
        totalCost: st?._sum.cost ?? 0,
        totalInputTokens: st?._sum.inputTokens ?? 0,
        totalOutputTokens: st?._sum.outputTokens ?? 0,
        successCount: successMap.get(s.model.slug) ?? 0,
        lastUsedAt: st?._max.createdAt ? st._max.createdAt.toISOString() : null,
      },
    };
  });
  return NextResponse.json({ items: rows });
}

// POST /api/keys/[id]/models — { modelIds: string[] } subscribe nhiều model 1 lần
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = await ensureOwnedKey(session.user.id, params.id);
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(b?.modelIds) ? b.modelIds.filter((x: any) => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "Thiếu modelIds" }, { status: 400 });

  // Chỉ cho subscribe model active
  const valid = await prisma.model.findMany({
    where: { id: { in: ids }, active: true },
    select: { id: true },
  });
  if (valid.length === 0) return NextResponse.json({ error: "Không có model hợp lệ" }, { status: 400 });

  const result = await prisma.apiKeyModel.createMany({
    data: valid.map((m) => ({ apiKeyId: params.id, modelId: m.id })),
    skipDuplicates: true,
  });
  return NextResponse.json({ ok: true, added: result.count });
}
