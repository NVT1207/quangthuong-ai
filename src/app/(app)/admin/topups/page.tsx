import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TopupsClient } from "./topups-client";

export const dynamic = "force-dynamic";

export default async function AdminTopupsPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const status = searchParams.status || "PENDING";
  const topups = await prisma.topupRequest.findMany({
    where: status === "ALL" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true, name: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Duyệt nạp tiền</h1>
        <p className="text-sm text-ink-200/60">Quản lý yêu cầu nạp tiền của người dùng</p>
      </div>

      <div className="flex gap-2">
        {["PENDING", "APPROVED", "REJECTED", "ALL"].map((s) => (
          <a key={s} href={`/admin/topups?status=${s}`}
            className={`btn ${status === s ? "btn-primary" : "btn-ghost"} text-xs`}>{s}</a>
        ))}
      </div>

      <TopupsClient items={topups.map((t) => ({
        id: t.id, amount: t.amount, method: t.method, reference: t.reference, note: t.note,
        status: t.status, createdAt: t.createdAt.toISOString(),
        processedAt: t.processedAt?.toISOString() ?? null,
        userEmail: t.user.email, userName: t.user.name,
      }))} />
    </div>
  );
}
