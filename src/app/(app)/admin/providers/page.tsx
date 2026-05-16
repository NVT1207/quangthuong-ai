import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProvidersClient } from "./providers-client";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const providers = await prisma.provider.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      keys: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, prefix: true, label: true, enabled: true,
          lastUsedAt: true, lastErrorAt: true, errorCount: true,
          totalRequests: true, totalErrors: true, createdAt: true,
        },
      },
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
          keys: p.keys.map((k) => ({
            ...k,
            createdAt: k.createdAt.toISOString(),
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            lastErrorAt: k.lastErrorAt?.toISOString() ?? null,
          })),
        }))}
      />
    </div>
  );
}
