import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TopupsClient } from "./topups-client";
import { BankTxClient } from "./bank-tx-client";

export const dynamic = "force-dynamic";

export default async function AdminTopupsPage({ searchParams }: { searchParams: { tab?: string; status?: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const tab = searchParams.tab === "bank" ? "bank" : "topups";
  const status = searchParams.status || "PENDING";

  if (tab === "bank") {
    const txs = await prisma.bankTransaction.findMany({
      orderBy: { transactionDate: "desc" },
      take: 100,
      include: {
        matchedTopup: {
          select: { id: true, amount: true, reference: true, user: { select: { email: true, name: true } } },
        },
      },
    });
    const unmatchedCount = await prisma.bankTransaction.count({ where: { matchedTopupId: null } });
    return (
      <div className="space-y-6">
        <PageHeader />
        <Tabs tab={tab} unmatched={unmatchedCount} />
        <BankTxClient items={txs.map((b) => ({
          id: b.id,
          gatewayTxId: b.gatewayTxId,
          gatewayName: b.gatewayName,
          accountNumber: b.accountNumber,
          amount: b.amount,
          content: b.content,
          transferType: b.transferType,
          reference: b.reference,
          matchedTopupId: b.matchedTopupId,
          transactionDate: b.transactionDate.toISOString(),
          createdAt: b.createdAt.toISOString(),
          matchedTopup: b.matchedTopup ? {
            id: b.matchedTopup.id,
            amount: b.matchedTopup.amount,
            reference: b.matchedTopup.reference,
            userEmail: b.matchedTopup.user.email,
            userName: b.matchedTopup.user.name,
          } : null,
        }))} />
      </div>
    );
  }

  const topups = await prisma.topupRequest.findMany({
    where: status === "ALL" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true, name: true } } },
  });
  const unmatchedCount = await prisma.bankTransaction.count({ where: { matchedTopupId: null } });

  return (
    <div className="space-y-6">
      <PageHeader />
      <Tabs tab={tab} unmatched={unmatchedCount} />

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
        autoApproved: t.autoApproved,
        receivedAmount: t.receivedAmount,
        userEmail: t.user.email, userName: t.user.name,
      }))} />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Duyệt nạp tiền</h1>
      <p className="text-sm text-ink-200/60">
        Quản lý yêu cầu nạp tiền + giao dịch ngân hàng nhận tự động qua Sepay webhook.
      </p>
    </div>
  );
}

function Tabs({ tab, unmatched }: { tab: string; unmatched: number }) {
  return (
    <div className="flex gap-2 border-b border-white/5 -mb-px">
      <a
        href="/admin/topups"
        className={
          tab === "topups"
            ? "px-3 py-2 text-sm font-medium border-b-2 border-sky-400 text-sky-200"
            : "px-3 py-2 text-sm font-medium text-ink-200/60 hover:text-ink-100"
        }
      >
        Yêu cầu nạp
      </a>
      <a
        href="/admin/topups?tab=bank"
        className={
          tab === "bank"
            ? "px-3 py-2 text-sm font-medium border-b-2 border-sky-400 text-sky-200"
            : "px-3 py-2 text-sm font-medium text-ink-200/60 hover:text-ink-100 inline-flex items-center gap-2"
        }
      >
        Giao dịch ngân hàng
        {unmatched > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-honey-500/15 text-honey-300 border border-honey-500/30">
            {unmatched} chưa khớp
          </span>
        )}
      </a>
    </div>
  );
}
