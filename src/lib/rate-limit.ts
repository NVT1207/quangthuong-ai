import { prisma } from "./prisma";

export const RATE_LIMIT_PER_MIN = 60;

export async function checkApiKeyRateLimit(apiKeyId: string) {
  const since = new Date(Date.now() - 60_000);
  const count = await prisma.usageLog.count({
    where: { apiKeyId, createdAt: { gte: since } },
  });
  return { ok: count < RATE_LIMIT_PER_MIN, count, limit: RATE_LIMIT_PER_MIN };
}
