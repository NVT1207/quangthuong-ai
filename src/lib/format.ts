export const USD_VND_RATE = 25000;

export function formatVND(n: number | null | undefined) {
  if (n === null || n === undefined) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatUSD(vnd: number | null | undefined) {
  if (vnd === null || vnd === undefined) return "$0.00";
  const usd = vnd / USD_VND_RATE;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(usd);
}

export const vndToUsd = (vnd: number) => vnd / USD_VND_RATE;
export const usdToVnd = (usd: number) => Math.round(usd * USD_VND_RATE);

export function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return "0";
  return new Intl.NumberFormat("vi-VN").format(n);
}

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
