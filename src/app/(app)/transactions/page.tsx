import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatVND, formatDateTime } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  TOPUP: { label: "Nạp tiền", color: "text-emerald-300 bg-emerald-500/15" },
  USAGE: { label: "Sử dụng API", color: "text-rose-300 bg-rose-500/15" },
  ADJUST: { label: "Điều chỉnh", color: "text-sky-300 bg-sky-500/15" },
};

export default async function TransactionsPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const txs = await prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sổ giao dịch</h1>
        <p className="text-sm text-ink-200/60">100 biến động số dư gần nhất</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Thời gian</th>
              <th className="table-th">Loại</th>
              <th className="table-th">Mô tả</th>
              <th className="table-th text-right">Thay đổi</th>
              <th className="table-th text-right">Số dư sau</th>
            </tr>
          </thead>
          <tbody>
            {txs.length === 0 ? (
              <tr><td colSpan={5} className="table-td text-center py-12 text-ink-200/50">Chưa có giao dịch</td></tr>
            ) : txs.map((t) => {
              const meta = TYPE_LABEL[t.type] || { label: t.type, color: "" };
              const isPositive = t.amount > 0;
              return (
                <tr key={t.id}>
                  <td className="table-td text-ink-200/70">{formatDateTime(t.createdAt)}</td>
                  <td className="table-td"><span className={`badge ${meta.color}`}>{meta.label}</span></td>
                  <td className="table-td text-ink-200/80">{t.description}</td>
                  <td className={`table-td text-right font-semibold ${isPositive ? "text-emerald-300" : "text-rose-300"}`}>
                    <span className="inline-flex items-center gap-1">
                      {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {isPositive ? "+" : ""}{formatVND(t.amount)}
                    </span>
                  </td>
                  <td className="table-td text-right">{formatVND(t.balanceAfter)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
