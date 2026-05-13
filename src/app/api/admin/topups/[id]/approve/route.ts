import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AFFILIATE_RATE } from "@/lib/affiliate";
import { topupBonus } from "@/lib/topup";
import { syncUserTier } from "@/lib/tier";

const METHOD_LABEL: Record<string, string> = {
  qr: "QR Vietinbank",
  bank: "ngân hàng",
  momo: "MoMo",
};

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const t = await prisma.topupRequest.findUnique({ where: { id: params.id }, include: { user: true } });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (t.status !== "PENDING") return NextResponse.json({ error: "Yêu cầu đã xử lý" }, { status: 400 });
  const bonus = topupBonus(t.amount);
  const newBalance = t.user.balance + t.amount + bonus;
  const methodLabel = METHOD_LABEL[t.method] || t.method;

  const ops: any[] = [
    prisma.topupRequest.update({
      where: { id: t.id },
      data: { status: "APPROVED", processedBy: session.user.id, processedAt: new Date() },
    }),
    prisma.user.update({ where: { id: t.userId }, data: { balance: newBalance } }),
    prisma.transaction.create({
      data: {
        userId: t.userId, type: "TOPUP",
        amount: t.amount + bonus,
        balanceAfter: newBalance,
        description: `Nạp tiền qua ${methodLabel}${t.reference ? ` (${t.reference})` : ""}${bonus > 0 ? ` + thưởng mệnh giá ${bonus.toLocaleString("vi-VN")}₫` : ""}`,
        refId: t.id,
      },
    }),
  ];

  if (t.user.referredById && t.user.referredById !== t.userId) {
    const earner = await prisma.user.findUnique({ where: { id: t.user.referredById } });
    if (earner && earner.status === "ACTIVE") {
      const commission = Math.round(t.amount * AFFILIATE_RATE);
      if (commission > 0) {
        const earnerNewBalance = earner.balance + commission;
        ops.push(
          prisma.user.update({ where: { id: earner.id }, data: { balance: earnerNewBalance } }),
          prisma.affiliateCommission.create({
            data: {
              earnerId: earner.id,
              referredId: t.userId,
              topupId: t.id,
              amount: commission,
              rate: AFFILIATE_RATE,
              description: `Hoa hồng ${(AFFILIATE_RATE * 100).toFixed(0)}% từ ${t.user.email}`,
            },
          }),
          prisma.transaction.create({
            data: {
              userId: earner.id,
              type: "AFFILIATE",
              amount: commission,
              balanceAfter: earnerNewBalance,
              description: `Hoa hồng affiliate từ ${t.user.email}`,
              refId: t.id,
            },
          }),
        );
      }
    }
  }

  await prisma.$transaction(ops);
  await syncUserTier(t.userId);
  return NextResponse.json({ ok: true });
}
