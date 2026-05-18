import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { KeysClient } from "./keys-client";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  // Public base URL hiển thị cho user copy vào tool 3rd-party.
  // Ưu tiên env override (đặt PUBLIC_BASE_URL=https://quangthuong-ai.vercel.app trên Vercel
  // để mọi preview/prod đều show URL canonical), fallback auto-detect từ host header.
  const h = headers();
  const envBase = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_PUBLIC_BASE_URL;
  let baseUrl: string;
  if (envBase) {
    baseUrl = envBase.replace(/\/+$/, "");
  } else {
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    baseUrl = `${proto}://${host}`;
  }

  const [keys, models] = await Promise.all([
    prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { models: true } } },
    }),
    prisma.model.findMany({
      where: { active: true, category: "text" },
      select: { slug: true, displayName: true, provider: true },
      orderBy: [{ provider: "asc" }, { displayName: "asc" }],
    }),
  ]);

  const stats = keys.length
    ? await prisma.usageLog.groupBy({
        by: ["apiKeyId"],
        where: { userId, apiKeyId: { in: keys.map((k) => k.id) } },
        _sum: { cost: true },
        _count: { _all: true },
      })
    : [];
  const statMap = new Map(
    stats.map((s) => [s.apiKeyId, { totalCost: s._sum.cost ?? 0, totalRequests: s._count._all }])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-sm text-ink-200/60">Tạo key để gọi API. Mỗi project nên dùng 1 key riêng.</p>
        </div>
      </div>

      <KeysClient
        baseUrl={baseUrl}
        models={models}
        initial={keys.map((k) => {
          const st = statMap.get(k.id);
          return {
            id: k.id,
            name: k.name,
            prefix: k.prefix,
            suffix: k.suffix,
            enabled: k.enabled,
            totalCost: st?.totalCost ?? 0,
            totalRequests: st?.totalRequests ?? 0,
            subscribedCount: k._count.models,
            createdAt: formatDateTime(k.createdAt),
            lastUsedAt: k.lastUsedAt ? formatDateTime(k.lastUsedAt) : null,
          };
        })}
      />
    </div>
  );
}
