import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAffiliateCode, AFFILIATE_RATE } from "@/lib/affiliate";
import { formatVND, formatDate } from "@/lib/format";
import { AffiliateShare } from "./share-client";
import { Users2, Wallet, BadgePercent, Gift } from "lucide-react";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AffiliatePage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const code = await ensureAffiliateCode(userId);

  const [referrals, commissions, totalAgg] = await Promise.all([
    prisma.user.count({ where: { referredById: userId } }),
    prisma.affiliateCommission.findMany({
      where: { earnerId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { referred: { select: { email: true, name: true } } },
    }),
    prisma.affiliateCommission.aggregate({
      where: { earnerId: userId },
      _sum: { amount: true },
    }),
  ]);
  const totalEarned = totalAgg._sum.amount || 0;

  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  const base = `${proto}://${host}`;
  const shareUrl = `${base}/register?ref=${code}`;

  const ratePct = (AFFILIATE_RATE * 100).toFixed(0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Affiliate</h1>
        <p className="text-sm text-ink-200/60">
          Giới thiệu bạn bè dùng QUANGTHUONG AI và nhận <span className="text-honey-300 font-semibold">{ratePct}% hoa hồng trọn đời</span> mỗi lần họ nạp tiền.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs text-ink-200/60 mb-2">
            <Users2 size={14} /> Số người đã giới thiệu
          </div>
          <p className="text-2xl font-bold">{referrals}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs text-ink-200/60 mb-2">
            <Wallet size={14} /> Tổng hoa hồng tích lũy
          </div>
          <p className="text-2xl font-bold text-honey-300">{formatVND(totalEarned)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs text-ink-200/60 mb-2">
            <BadgePercent size={14} /> Tỷ lệ hoa hồng
          </div>
          <p className="text-2xl font-bold">{ratePct}%</p>
          <p className="text-[10px] text-ink-200/40 mt-1">Trọn đời mỗi lần nạp</p>
        </div>
      </div>

      <AffiliateShare code={code} shareUrl={shareUrl} />

      <div className="card p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-honey-500/10 border border-honey-500/20 flex items-center justify-center shrink-0">
            <Gift size={18} className="text-honey-300" />
          </div>
          <div>
            <h3 className="font-semibold mb-2">Cách hoạt động</h3>
            <ol className="space-y-1.5 text-sm text-ink-200/70 list-decimal list-inside">
              <li>Chia sẻ link giới thiệu phía trên cho bạn bè hoặc cộng đồng.</li>
              <li>Khi họ đăng ký qua link, tài khoản được gắn vĩnh viễn với mã của bạn.</li>
              <li>Mỗi lần họ nạp tiền (và được admin duyệt), bạn nhận {ratePct}% giá trị giao dịch — cộng thẳng vào số dư.</li>
              <li>Không giới hạn số người, không giới hạn thời gian, không cần rút riêng.</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-semibold">Lịch sử hoa hồng</h3>
          <span className="text-xs text-ink-200/40">{commissions.length} bản ghi gần nhất</span>
        </div>
        {commissions.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink-200/60">
            Chưa có hoa hồng nào. Hãy chia sẻ link để bắt đầu kiếm thu nhập thụ động.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Thời gian</th>
                  <th className="table-th">Người được giới thiệu</th>
                  <th className="table-th text-right">Tỷ lệ</th>
                  <th className="table-th text-right">Hoa hồng</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id}>
                    <td className="table-td text-xs text-ink-200/60">{formatDate(c.createdAt)}</td>
                    <td className="table-td">
                      <p className="text-sm">{c.referred.name || c.referred.email}</p>
                      {c.referred.name && <p className="text-[10px] text-ink-200/40">{c.referred.email}</p>}
                    </td>
                    <td className="table-td text-right text-xs">{(c.rate * 100).toFixed(0)}%</td>
                    <td className="table-td text-right text-honey-300 font-medium">+{formatVND(c.amount)}</td>
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
