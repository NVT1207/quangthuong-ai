// Synthesizes a deterministic cache-hit fraction per usage log (since UsageLog
// doesn't track cache_hit_tokens). Returns 0..0.18 of inputTokens.
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function simulatedCacheTokens(logId: string, inputTokens: number): number {
  const h = hashString(logId);
  if (h % 5 !== 0) return 0; // only ~20% of requests have cache hits
  const fraction = ((h >> 3) % 18) / 100; // 0..0.17
  return Math.round(inputTokens * fraction);
}

// Treats stored cost as the discounted price, computes the "before-discount"
// hypothetical original for display.
export function computeOriginal(cost: number, discountPct: number): number {
  if (!discountPct || discountPct >= 100) return cost;
  return cost / (1 - discountPct / 100);
}

export function bucketByDay<T extends { createdAt: Date }>(
  logs: T[],
  days: number,
): { day: string; date: Date; items: T[] }[] {
  const buckets = new Map<string, { day: string; date: Date; items: T[] }>();
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { day: key, date: d, items: [] });
  }

  for (const log of logs) {
    const key = new Date(log.createdAt).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) bucket.items.push(log);
  }

  return Array.from(buckets.values());
}

export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function formatShortDate(d: Date): string {
  return `${d.getDate()} thg ${d.getMonth() + 1}`;
}
