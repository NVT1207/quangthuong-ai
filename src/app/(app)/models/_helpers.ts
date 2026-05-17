import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Tier } from "@/lib/tier-config";

export async function loadModelsByCategory(categories: string[]) {
  const [models, session] = await Promise.all([
    prisma.model.findMany({
      where: { active: true, category: { in: categories } },
      orderBy: [{ provider: "asc" }, { displayName: "asc" }],
    }),
    getServerSession(authOptions),
  ]);

  let userTier: Tier = "FREE";
  if (session?.user?.id) {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tier: true },
    });
    userTier = (u?.tier as Tier) ?? "FREE";
  }

  const providers = [...new Set(models.map((m) => m.provider))].sort();
  return {
    providers,
    userTier,
    models: models.map((m) => ({
      id: m.id,
      slug: m.slug,
      displayName: m.displayName,
      provider: m.provider,
      category: m.category,
      priceUnit: m.priceUnit,
      inputPrice: m.inputPrice,
      outputPrice: m.outputPrice,
      contextLength: m.contextLength,
      description: m.description,
      freeDiscount: m.freeDiscount,
      basicDiscount: m.basicDiscount,
      advDiscount: m.advDiscount,
      speedTps: m.speedTps,
      latencyMs: m.latencyMs,
      uptimeStatus: m.uptimeStatus,
    })),
  };
}
