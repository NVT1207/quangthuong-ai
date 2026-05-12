import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PlaygroundClient } from "./playground-client";

export const dynamic = "force-dynamic";

export default async function PlaygroundPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const [models, keys] = await Promise.all([
    prisma.model.findMany({ where: { active: true, category: "text" }, orderBy: { displayName: "asc" } }),
    prisma.apiKey.findMany({ where: { userId, revokedAt: null }, orderBy: { createdAt: "desc" }, take: 1 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Playground</h1>
        <p className="text-sm text-ink-200/60">Thử model trực tiếp trên giao diện. Mỗi request dùng key của bạn và trừ tiền thật.</p>
      </div>

      {keys.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-ink-200/70 mb-3">Bạn cần ít nhất 1 API key để dùng Playground</p>
          <a href="/api-keys" className="btn btn-primary inline-flex">Tạo key</a>
        </div>
      ) : (
        <PlaygroundClient models={models.map((m) => ({ slug: m.slug, name: m.displayName, provider: m.provider }))} />
      )}
    </div>
  );
}
