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
  const models = await prisma.model.findMany({ orderBy: { displayName: "asc" } });

  const modelsOut = models.map((m) => {
    let plainKey = "";
    if (m.apiKeyEnc) {
      try { plainKey = decryptKey(m.apiKeyEnc); } catch { plainKey = ""; }
    }
    return {
      ...m,
      createdAt: m.createdAt.toISOString(),
      lastUsedAt: m.lastUsedAt?.toISOString() ?? null,
      lastErrorAt: m.lastErrorAt?.toISOString() ?? null,
      apiKey: plainKey, // plaintext cho admin
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quản lý Models</h1>
        <p className="text-sm text-ink-200/60">Thêm/sửa model + API key upstream</p>
      </div>
      <ModelsAdminClient initial={modelsOut} />
    </div>
  );
}
