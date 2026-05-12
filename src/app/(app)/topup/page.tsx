import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatVND } from "@/lib/format";
import { topupBonus } from "@/lib/topup";
import { TopupForm } from "./topup-form";
import { HistoryTabs } from "./history-tabs";
import { Info } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TopupPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const [user, topups, usage] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { balance: true } }),
    prisma.topupRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.usageLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, modelSlug: true, cost: true, createdAt: true },
    }),
  ]);

  // pair usage logs with their resulting balance from Transaction
  const usageIds = usage.map((u) => u.id);
  const usageTxs = usageIds.length
    ? await prisma.transaction.findMany({
        where: { userId, type: "USAGE", refId: { in: usageIds } },
        select: { refId: true, balanceAfter: true },
      })
    : [];
  const balanceByUsageId = new Map(usageTxs.map((t) => [t.refId, t.balanceAfter]));

  const usageItems = usage.map((u) => ({
    id: u.id,
    modelSlug: u.modelSlug,
    cost: u.cost,
    balanceAfter: balanceByUsageId.get(u.id) ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  const topupItems = topups.map((t) => ({
    id: t.id,
    amount: t.amount,
    bonus: topupBonus(t.amount),
    method: t.method,
    reference: t.reference,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    processedAt: t.processedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-5">
        <div className="card p-5 lg:p-6">
          <h2 className="text-lg font-semibold">Số dư hiện tại</h2>
          <p className="text-sm text-ink-200/60">Số tiền có thể sử dụng để thanh toán API</p>

          <div className="mt-5 flex items-center gap-2">
            <p className="text-3xl font-bold text-honey-300">
              {formatVND(user?.balance ?? 0).replace(" ₫", "")} <span className="text-xl text-ink-200/70">VNĐ</span>
            </p>
            <Info size={14} className="text-ink-200/40" />
          </div>

          <div className="mt-5 text-xs leading-relaxed text-ink-200/65 border-l-2 border-honey-500/30 pl-3">
            Theo <Link href="https://thuvienphapluat.vn" target="_blank" className="text-rose-300 hover:underline font-medium">Nghị định 70/2025/NĐ-CP</Link> (hiệu lực từ 01/06/2025), doanh nghiệp bán hàng online phải xuất hóa đơn điện tử. QUANGTHUONG AI cam kết bảo mật và chỉ dùng thông tin của bạn cho mục đích lập hóa đơn. Vui lòng cập nhật thông tin của bạn chính xác nếu như bạn cần xuất hóa đơn:{" "}
            <Link href="/settings" className="text-sky-300 hover:underline font-medium">Tại đây</Link>
          </div>
        </div>

        <TopupForm />
      </div>

      <HistoryTabs usage={usageItems} topups={topupItems} />
    </div>
  );
}
