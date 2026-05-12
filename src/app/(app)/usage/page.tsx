import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsageClient } from "./usage-client";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const start90 = new Date();
  start90.setDate(start90.getDate() - 89);
  start90.setHours(0, 0, 0, 0);

  const [logs, models] = await Promise.all([
    prisma.usageLog.findMany({
      where: { userId, createdAt: { gte: start90 } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.model.findMany({
      select: {
        slug: true,
        displayName: true,
        provider: true,
        inputPrice: true,
        outputPrice: true,
        freeDiscount: true,
      },
    }),
  ]);

  const logsForClient = logs.map((l) => ({
    id: l.id,
    modelSlug: l.modelSlug,
    inputTokens: l.inputTokens,
    outputTokens: l.outputTokens,
    cost: l.cost,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
  }));

  return <UsageClient logs={logsForClient} models={models} />;
}
