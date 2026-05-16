import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { decryptKey } from "@/lib/key-cipher";
import { ModelsAdminClient } from "./models-client";

export const dynamic = "force-dynamic";

export default async function AdminModelsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/dashboard");
  const [models, providers] = await Promise.all([
    prisma.model.findMany({ orderBy: { displayName: "asc" } }),
    prisma.provider.findMany({
      orderBy: { name: "asc" },
      include: {
        keys: { orderBy: { createdAt: "asc" } },
        _count: { select: { models: true } },
      },
    }),
  ]);

  const providersOut = providers.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    baseUrl: p.baseUrl,
    routing: p.routing,
    enabled: p.enabled,
    modelsCount: p._count.models,
    keys: p.keys.map((k) => {
      let plainKey = "";
      try { plainKey = decryptKey(k.encryptedKey); } catch { plainKey = ""; }
      return {
        id: k.id,
        label: k.label,
        enabled: k.enabled,
        plainKey,
      };
    }),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quản lý Models</h1>
        <p className="text-sm text-ink-200/60">Thêm/sửa model, gán provider + key</p>
      </div>
      <ModelsAdminClient
        initial={models.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
        providers={providersOut}
      />
    </div>
  );
}
