import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ModelsAdminClient } from "./models-client";

export const dynamic = "force-dynamic";

export default async function AdminModelsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/dashboard");
  const models = await prisma.model.findMany({ orderBy: { displayName: "asc" } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quản lý Models</h1>
        <p className="text-sm text-ink-200/60">Thêm/sửa model và bảng giá</p>
      </div>
      <ModelsAdminClient initial={models.map((m) => ({
        ...m, createdAt: m.createdAt.toISOString(),
      }))} />
    </div>
  );
}
