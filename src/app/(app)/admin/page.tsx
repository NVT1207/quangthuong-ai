import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatsCard } from "@/components/stats-card";
import { Users, Activity, Coins, Boxes } from "lucide-react";
import { formatVND, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return null;

  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);

  const [users, models, requestsToday, revenueAgg, topModels, recentTopups] = await Promise.all([
    prisma.user.count(),
    prisma.model.count({ where: { active: true } }),
    prisma.usageLog.count({ where: { createdAt: { gte: startToday } } }),
    prisma.topupRequest.aggregate({ where: { status: "APPROVED" }, _sum: { amount: true } }),
    prisma.usageLog.groupBy({
      by: ["modelSlug"],
      _count: true,
      orderBy: { _count: { modelSlug: "desc" } },
      take: 5,
    }),
    prisma.topupRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { email: true, name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="text-sm text-ink-200/60">Tổng quan toàn hệ thống</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard icon={Users} label="Người dùng" value={formatNumber(users)} accent="blue" />
        <StatsCard icon={Boxes} label="Model đang bật" value={formatNumber(models)} accent="honey" />
        <StatsCard icon={Activity} label="Request hôm nay" value={formatNumber(requestsToday)} accent="green" />
        <StatsCard icon={Coins} label="Tổng doanh thu" value={formatVND(revenueAgg._sum.amount || 0)} accent="rose" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="font-medium mb-3">Top 5 model dùng nhiều nhất</p>
          {topModels.length === 0 ? (
            <p className="text-sm text-ink-200/50 py-6 text-center">Chưa có request</p>
          ) : (
            <div className="space-y-2">
              {topModels.map((m, i) => (
                <div key={m.modelSlug} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
                  <span className="text-sm"><span className="text-ink-200/40 mr-2">#{i + 1}</span>{m.modelSlug}</span>
                  <span className="badge bg-honey-500/10 text-honey-300">{formatNumber(m._count)} req</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <p className="font-medium mb-3">Yêu cầu nạp tiền đang chờ</p>
          {recentTopups.length === 0 ? (
            <p className="text-sm text-ink-200/50 py-6 text-center">Không có yêu cầu chờ duyệt 🎉</p>
          ) : (
            <div className="space-y-2">
              {recentTopups.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
                  <span className="text-sm">{t.user.name || t.user.email}</span>
                  <span className="text-honey-300 font-medium">{formatVND(t.amount)}</span>
                </div>
              ))}
              <a href="/admin/topups" className="btn btn-ghost w-full mt-2 text-xs">Đi tới trang duyệt</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
