import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatsCard } from "@/components/stats-card";
import { UsageChart } from "@/components/usage-chart";
import { Wallet, Activity, Coins, Hash } from "lucide-react";
import { formatVND, formatNumber, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start7 = new Date(startToday); start7.setDate(start7.getDate() - 6);

  const [todayLogs, weekLogs, recentLogs] = await Promise.all([
    prisma.usageLog.findMany({ where: { userId, createdAt: { gte: startToday } } }),
    prisma.usageLog.findMany({ where: { userId, createdAt: { gte: start7 } }, orderBy: { createdAt: "asc" } }),
    prisma.usageLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const todayReq = todayLogs.length;
  const todayTokens = todayLogs.reduce((s, l) => s + l.inputTokens + l.outputTokens, 0);
  const todayCost = todayLogs.reduce((s, l) => s + l.cost, 0);

  const byDay = new Map<string, { cost: number; requests: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(start7); d.setDate(d.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), { cost: 0, requests: 0 });
  }
  for (const l of weekLogs) {
    const k = l.createdAt.toISOString().slice(0, 10);
    const cur = byDay.get(k) ?? { cost: 0, requests: 0 };
    cur.cost += l.cost; cur.requests += 1;
    byDay.set(k, cur);
  }
  const chartData = [...byDay.entries()].map(([k, v]) => ({
    date: k.slice(5),
    cost: Math.round(v.cost),
    requests: v.requests,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tổng quan</h1>
        <p className="text-sm text-ink-200/60">Theo dõi sử dụng API và số dư của bạn</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard icon={Wallet} label="Số dư" value={formatVND(user!.balance)} hint="Khả dụng để gọi API" />
        <StatsCard icon={Activity} label="Requests hôm nay" value={formatNumber(todayReq)} accent="blue" />
        <StatsCard icon={Hash} label="Tokens hôm nay" value={formatNumber(todayTokens)} accent="green" />
        <StatsCard icon={Coins} label="Chi phí hôm nay" value={formatVND(todayCost)} accent="rose" />
      </div>

      <UsageChart data={chartData} />

      <div className="card p-5">
        <p className="font-medium mb-4">Hoạt động gần đây</p>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-ink-200/50 py-6 text-center">Chưa có request nào — tạo API key và thử Playground!</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Thời gian</th>
                  <th className="table-th">Model</th>
                  <th className="table-th text-right">Input</th>
                  <th className="table-th text-right">Output</th>
                  <th className="table-th text-right">Chi phí</th>
                  <th className="table-th text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="table-td text-ink-200/70">{formatDateTime(l.createdAt)}</td>
                    <td className="table-td"><span className="badge bg-white/5">{l.modelSlug}</span></td>
                    <td className="table-td text-right">{formatNumber(l.inputTokens)}</td>
                    <td className="table-td text-right">{formatNumber(l.outputTokens)}</td>
                    <td className="table-td text-right text-honey-300">{formatVND(l.cost)}</td>
                    <td className="table-td text-right">
                      <span className={`badge ${l.status === 200 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{l.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
