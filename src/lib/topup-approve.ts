// Logic approve TopupRequest dùng chung cho: admin manual approve + Sepay webhook auto-approve.
// Idempotent: nếu đã APPROVED thì skip; nếu chưa thì cộng tiền, log Transaction, chia affiliate, sync tier.

import { prisma } from "@/lib/prisma";
import { AFFILIATE_RATE } from "@/lib/affiliate";
import { topupBonus } from "@/lib/topup";
import { syncUserTier } from "@/lib/tier";

const METHOD_LABEL: Record<string, string> = {
  qr: "QR Vietinbank",
  bank: "ngân hàng",
  momo: "MoMo",
};

export type ApproveOpts = {
  /** Số tiền thực nhận từ ngân hàng. Nếu null → dùng amount đăng ký. */
  receivedAmount?: number;
  /** True khi do webhook tự duyệt; admin thì false. */
  autoApproved?: boolean;
  /** User id của admin duyệt (null khi auto). */
  processedBy?: string | null;
  /** Mô tả nguồn để gắn vào Transaction (vd "Sepay webhook"). */
  sourceLabel?: string;
};

export type ApproveResult = {
  ok: boolean;
  alreadyProcessed?: boolean;
  topupId: string;
  userId: string;
  amountCredited: number;
  bonus: number;
  newBalance: number;
};

/**
 * Approve một TopupRequest. Idempotent — gọi nhiều lần không double-credit.
 */
export async function approveTopup(topupId: string, opts: ApproveOpts = {}): Promise<ApproveResult> {
  const t = await prisma.topupRequest.findUnique({
    where: { id: topupId },
    include: { user: true },
  });
  if (!t) throw new Error("Topup không tồn tại");

  if (t.status !== "PENDING") {
    return {
      ok: false,
      alreadyProcessed: true,
      topupId: t.id,
      userId: t.userId,
      amountCredited: 0,
      bonus: 0,
      newBalance: t.user.balance,
    };
  }

  // Số tiền thực ghi nhận: ưu tiên receivedAmount (từ bank), fallback amount đăng ký
  const credited = opts.receivedAmount ?? t.amount;
  // Bonus tính theo số THỰC nhận (user chuyển ít hơn → bonus theo bậc thấp hơn)
  const bonus = topupBonus(credited);

  // Promo bonus: snapshot khi tạo TopupRequest. CHỈ áp dụng nếu user chuyển ĐỦ amount đăng ký
  // (tránh trường hợp user chuyển ít hơn để vẫn ăn % bonus của mức cao).
  let promoBonusToCredit = 0;
  let promoCodeRecord: { id: string; code: string } | null = null;
  if (t.promoCode && t.promoBonus && t.promoBonus > 0 && credited >= t.amount) {
    const promo = await prisma.promoCode.findUnique({
      where: { code: t.promoCode },
      select: { id: true, code: true, enabled: true, expiresAt: true, maxUses: true, usedCount: true },
    });
    if (promo && promo.enabled) {
      const now = new Date();
      const notExpired = !promo.expiresAt || now <= promo.expiresAt;
      const hasQuota = promo.maxUses == null || promo.usedCount < promo.maxUses;
      if (notExpired && hasQuota) {
        promoBonusToCredit = t.promoBonus;
        promoCodeRecord = { id: promo.id, code: promo.code };
      }
    }
  }

  const totalBonus = bonus + promoBonusToCredit;
  const newBalance = t.user.balance + credited + totalBonus;
  const methodLabel = METHOD_LABEL[t.method] || t.method;

  const autoSuffix = opts.autoApproved ? " (tự động duyệt)" : "";
  const amountSuffix = opts.receivedAmount != null && opts.receivedAmount !== t.amount
    ? ` (thực nhận ${credited.toLocaleString("vi-VN")}₫ vs đăng ký ${t.amount.toLocaleString("vi-VN")}₫)`
    : "";
  const sourceSuffix = opts.sourceLabel ? ` — ${opts.sourceLabel}` : "";
  const promoSuffix = promoBonusToCredit > 0 && promoCodeRecord
    ? ` + ưu đãi ${promoCodeRecord.code} ${promoBonusToCredit.toLocaleString("vi-VN")}₫`
    : "";

  const description =
    `Nạp tiền qua ${methodLabel}${t.reference ? ` (${t.reference})` : ""}` +
    `${bonus > 0 ? ` + thưởng mệnh giá ${bonus.toLocaleString("vi-VN")}₫` : ""}` +
    `${promoSuffix}${amountSuffix}${autoSuffix}${sourceSuffix}`;

  const ops: any[] = [
    prisma.topupRequest.update({
      where: { id: t.id },
      data: {
        status: "APPROVED",
        processedBy: opts.processedBy ?? null,
        processedAt: new Date(),
        autoApproved: opts.autoApproved ?? false,
        receivedAmount: credited,
      },
    }),
    prisma.user.update({ where: { id: t.userId }, data: { balance: newBalance } }),
    prisma.transaction.create({
      data: {
        userId: t.userId,
        type: "TOPUP",
        amount: credited + totalBonus,
        balanceAfter: newBalance,
        description,
        refId: t.id,
      },
    }),
  ];

  // Promo redemption: ghi nhận lần dùng mã + tăng usedCount của PromoCode
  if (promoCodeRecord && promoBonusToCredit > 0) {
    ops.push(
      prisma.promoRedemption.create({
        data: {
          promoCodeId: promoCodeRecord.id,
          userId: t.userId,
          topupId: t.id,
          amount: credited,
          bonus: promoBonusToCredit,
        },
      }),
      prisma.promoCode.update({
        where: { id: promoCodeRecord.id },
        data: { usedCount: { increment: 1 } },
      }),
    );
  }

  // Affiliate commission (chỉ tính trên số THỰC nhận, không tính bonus)
  if (t.user.referredById && t.user.referredById !== t.userId) {
    const earner = await prisma.user.findUnique({ where: { id: t.user.referredById } });
    if (earner && earner.status === "ACTIVE") {
      const commission = Math.round(credited * AFFILIATE_RATE);
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

  return {
    ok: true,
    topupId: t.id,
    userId: t.userId,
    amountCredited: credited,
    bonus: totalBonus,
    newBalance,
  };
}

/**
 * Parse reference code (vd "QT3F2A1B") từ nội dung chuyển khoản. Match case-insensitive.
 */
export function parseReferenceFromContent(content: string): string | null {
  if (!content) return null;
  const m = content.toUpperCase().match(/QT[A-F0-9]{6}/);
  return m ? m[0] : null;
}
