export const BANK_INFO = {
  bankName: "Vietinbank",
  bankCode: "ICB",
  bin: "970415",
  accountNumber: "101872834062",
  accountName: "NGUYEN VAN THUONG",
};

export const PRESET_AMOUNTS: { value: number; bonus: number }[] = [
  { value: 100_000, bonus: 0 },
  { value: 1_000_000, bonus: 0 },
  { value: 10_000_000, bonus: 200_000 },
  { value: 100_000_000, bonus: 5_000_000 },
];

// Legacy hardcoded promo list — đã chuyển sang model PromoCode trong DB.
// Giữ export trống để backward-compat phòng UI cũ cache. KHÔNG dùng nữa.
export const PROMO_CODES: string[] = [];

export function topupBonus(amount: number): number {
  if (amount >= 100_000_000) return 5_000_000;
  if (amount >= 10_000_000) return 200_000;
  return 0;
}

export function buildVietQrUrl(opts: { amount: number; addInfo: string }) {
  const params = new URLSearchParams({
    amount: String(opts.amount),
    addInfo: opts.addInfo,
    accountName: BANK_INFO.accountName,
  });
  return `https://img.vietqr.io/image/${BANK_INFO.bin}-${BANK_INFO.accountNumber}-compact2.png?${params.toString()}`;
}
