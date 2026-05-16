import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { decryptKey } from "@/lib/key-cipher";
import { ProvidersClient } from "./providers-client";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const providers = await prisma.provider.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      keys: { orderBy: { createdAt: "asc" } },
      _count: { select: { models: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quản lý Providers</h1>
        <p className="text-sm text-ink-200/60">
          Tạo nhiều provider + multi API key. Gateway tự routing/failover theo strategy.
        </p>
      </div>
      <ProvidersClient
        initial={providers.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          modelsCount: p._count.models,
          keys: p.keys.map((k) => {
            let plainKey = "";
            try { plainKey = decryptKey(k.encryptedKey); } catch { plainKey = ""; }
            return {
              id: k.id,
              prefix: k.prefix,
              label: k.label,
              enabled: k.enabled,
              lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
              lastErrorAt: k.lastErrorAt?.toISOString() ?? null,
              errorCount: k.errorCount,
              totalRequests: k.totalRequests,
              totalErrors: k.totalErrors,
              createdAt: k.createdAt.toISOString(),
              plainKey,
            };
          }),
        }))}
      />
    </div>
  );
}
