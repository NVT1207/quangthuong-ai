import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = await prisma.apiKey.findUnique({ where: { id: params.id } });
  if (!key || key.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [agg, sevenDayLogs, topModels, recent, modelList] = await Promise.all([
    prisma.usageLog.aggregate({
      where: { apiKeyId: key.id },
      _count: { _all: true },
      _sum: { cost: true, inputTokens: true, outputTokens: true },
    }),
    prisma.usageLog.findMany({
      where: { apiKeyId: key.id, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, cost: true },
    }),
    prisma.usageLog.groupBy({
      by: ["modelSlug"],
      where: { apiKeyId: key.id },
      _count: { _all: true },
      _sum: { cost: true },
      orderBy: { _count: { modelSlug: "desc" } },
      take: 5,
    }),
    prisma.usageLog.findMany({
      where: { apiKeyId: key.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, modelSlug: true, inputTokens: true, outputTokens: true, cost: true, status: true, createdAt: true },
    }),
    prisma.model.findMany({ select: { slug: true, displayName: true } }),
  ]);

  // bucket into 7 days (oldest -> newest)
  const buckets: { date: string; cost: number; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayKey = d.toISOString().slice(0, 10);
    buckets.push({ date: dayKey, cost: 0, count: 0 });
  }
  for (const log of sevenDayLogs) {
    const dayKey = log.createdAt.toISOString().slice(0, 10);
    const b = buckets.find((x) => x.date === dayKey);
    if (b) { b.cost += log.cost; b.count += 1; }
  }

  const modelNameBySlug = new Map(modelList.map((m) => [m.slug, m.displayName]));

  return NextResponse.json({
    key: {
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      suffix: key.suffix,
      enabled: key.enabled,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
    },
    stats: {
      totalRequests: agg._count._all,
      totalCost: agg._sum.cost ?? 0,
      totalInputTokens: agg._sum.inputTokens ?? 0,
      totalOutputTokens: agg._sum.outputTokens ?? 0,
    },
    chart: buckets,
    topModels: topModels.map((m) => ({
      slug: m.modelSlug,
      displayName: modelNameBySlug.get(m.modelSlug) ?? m.modelSlug,
      count: m._count._all,
      cost: m._sum.cost ?? 0,
    })),
    recent: recent.map((r) => ({
      id: r.id,
      modelSlug: r.modelSlug,
      modelName: modelNameBySlug.get(r.modelSlug) ?? r.modelSlug,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cost: r.cost,
      status: r.status,
      createdAt: r.createdAt,
    })),
  });
}
