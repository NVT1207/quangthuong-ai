// Promo code validation + bonus computation.
// Dùng chung cho:
//  - POST /api/topup           (user nhập mã + tạo TopupRequest, snapshot promoBonus)
//  - POST /api/promo/validate  (validate real-time khi user gõ ở form)
//  - approveTopup()            (cộng promoBonus + create PromoRedemption + tăng usedCount)

import { prisma } from "@/lib/prisma";
import type { PromoCode } from "@prisma/client";

export type PromoValidateResult =
  | { ok: true; code: PromoCode; bonus: number }
  | { ok: false; reason: string };

export function normalizePromoCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase().slice(0, 32);
}

/**
 * Tính bonus theo loại mã. Nếu PERCENT → amount × bonusPercent / 100, cap bằng maxBonus (nếu có).
 * Nếu FIXED → bonusAmount cố định.
 */
export function computePromoBonus(code: PromoCode, amount: number): number {
  if (!amount || amount <= 0) return 0;
  let raw = 0;
  if (code.bonusType === "FIXED") {
    raw = Math.max(0, code.bonusAmount);
  } else {
    // PERCENT mặc định
    raw = (amount * Math.max(0, code.bonusPercent)) / 100;
  }
  if (code.maxBonus != null && code.maxBonus > 0) {
    raw = Math.min(raw, code.maxBonus);
  }
  return Math.round(raw);
}

/**
 * Validate mã đầy đủ: exist, enabled, trong khung thời gian, đủ minAmount, chưa hết maxUses,
 * (nếu firstUseOnly) user CHƯA TỪNG redeem mã này.
 *
 * Trả về { ok: true, code, bonus } khi pass, hoặc { ok: false, reason } với message tiếng Việt.
 */
export async function validatePromoCode(
  rawCode: string,
  amount: number,
  userId: string,
): Promise<PromoValidateResult> {
  const code = normalizePromoCode(rawCode);
  if (!code) return { ok: false, reason: "Vui lòng nhập mã khuyến mãi" };
  if (!amount || amount <= 0) return { ok: false, reason: "Vui lòng nhập số tiền nạp trước" };

  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo) return { ok: false, reason: "Mã khuyến mãi không tồn tại" };
  if (!promo.enabled) return { ok: false, reason: "Mã khuyến mãi đã bị vô hiệu hóa" };

  const now = new Date();
  if (promo.startsAt && now < promo.startsAt) {
    return { ok: false, reason: "Mã khuyến mãi chưa đến thời gian áp dụng" };
  }
  if (promo.expiresAt && now > promo.expiresAt) {
    return { ok: false, reason: "Mã khuyến mãi đã hết hạn" };
  }

  if (amount < promo.minAmount) {
    return {
      ok: false,
      reason: `Số tiền nạp tối thiểu để áp dụng mã này là ${promo.minAmount.toLocaleString("vi-VN")}₫`,
    };
  }

  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    return { ok: false, reason: "Mã khuyến mãi đã hết lượt sử dụng" };
  }

  if (promo.firstUseOnly) {
    const prev = await prisma.promoRedemption.findFirst({
      where: { promoCodeId: promo.id, userId },
      select: { id: true },
    });
    if (prev) {
      return { ok: false, reason: "Bạn đã sử dụng mã này trước đó" };
    }
  }

  const bonus = computePromoBonus(promo, amount);
  if (bonus <= 0) {
    return { ok: false, reason: "Mã khuyến mãi không hợp lệ (bonus = 0)" };
  }
  return { ok: true, code: promo, bonus };
}
