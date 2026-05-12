import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatVND, formatNumber, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage({ searchParams }: { searchParams: { user?: string; model?: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const where: any = {};
  if (searchParams.user) where.user = { email: { contains: searchParams.user } };
  if (searchParams.model) where.modelSlug = searchParams.model;

  const [logs, models] = await Promise.all([
    prisma.usageLog.findMany({
      where, orderBy: { createdAt: "desc" }, take: 200,
      include: { user: { select: { email: true } } },
    }),
    prisma.model.findMany({ select: { slug: true, displayName: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Logs hệ thống</h1>
        <p className="text-sm text-ink-200/60">200 request gần nhất từ toàn bộ user</p>
      </div>

      <form className="card p-4 flex gap-2 flex-wrap items-end">
        <div><label className="label">Email user</label><input name="user" defaultValue={searchParams.user || ""} className="input w-64" placeholder="demo@..." /></div>
        <div><label className="label">Model</label>
          <select name="model" defaultValue={searchParams.model || ""} className="input">
            <option value="">Tất cả</option>
            {models.map((m) => <option key={m.slug} value={m.slug}>{m.displayName}</option>)}
          </select>
        </div>
        <button className="btn btn-primary">Lọc</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Thời gian</th>
              <th className="table-th">User</th>
              <th className="table-th">Model</th>
              <th className="table-th text-right">Tokens</th>
              <th className="table-th text-right">Chi phí</th>
              <th className="table-th">IP</th>
              <th className="table-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={7} className="table-td text-center py-12 text-ink-200/50">Không có log</td></tr>
            ) : logs.map((l) => (
              <tr key={l.id}>
                <td className="table-td text-ink-200/70">{formatDateTime(l.createdAt)}</td>
                <td className="table-td text-sm">{l.user.email}</td>
                <td className="table-td"><span className="badge bg-white/5">{l.modelSlug}</span></td>
                <td className="table-td text-right">{formatNumber(l.inputTokens)} / {formatNumber(l.outputTokens)}</td>
                <td className="table-td text-right text-honey-300">{formatVND(l.cost)}</td>
                <td className="table-td text-ink-200/60 font-mono text-xs">{l.ip || "—"}</td>
                <td className="table-td"><span className={`badge ${l.status === 200 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{l.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
