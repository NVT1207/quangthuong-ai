import { prisma } from "@/lib/prisma";

export async function loadModelsByCategory(categories: string[]) {
  const models = await prisma.model.findMany({
    where: { active: true, category: { in: categories } },
    orderBy: [{ provider: "asc" }, { displayName: "asc" }],
  });
  const providers = [...new Set(models.map((m) => m.provider))].sort();
  return {
    providers,
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
