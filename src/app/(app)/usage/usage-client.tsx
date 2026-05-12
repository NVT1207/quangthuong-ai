"use client";
import { useMemo, useState } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Hash, Zap, CreditCard, TrendingUp, Sparkles, PiggyBank, Calendar, Receipt, CheckCircle2, Download } from "lucide-react";
import { formatVND, formatNumber, formatDateTime } from "@/lib/format";
import { simulatedCacheTokens, computeOriginal, formatShortDate, daysInMonth } from "@/lib/usage-stats";

type LogItem = {
  id: string;
  modelSlug: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  status: number;
  createdAt: string;
};

type ModelMeta = {
  slug: string;
  displayName: string;
  provider: string;
  inputPrice: number;
  outputPrice: number;
  freeDiscount: number;
};

const PIE_COLORS = ["#a855f7", "#3b82f6", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#ef4444", "#84cc16"];

export function UsageClient({ logs, models }: { logs: LogItem[]; models: ModelMeta[] }) {
  const [range, setRange] = useState<7 | 30 | 90>(7);
  const [statusFilter, setStatusFilter] = useState<"all" | "ok" | "fail">("all");

  const modelMap = useMemo(() => {
    const m = new Map<string, ModelMeta>();
    for (const md of models) m.set(md.slug, md);
    return m;
  }, [models]);

  const enriched = useMemo(() => {
    return logs.map((l) => {
      const meta = modelMap.get(l.modelSlug);
      const discount = meta?.freeDiscount ?? 0;
      const cacheTokens = simulatedCacheTokens(l.id, l.inputTokens);
      const totalTokens = l.inputTokens + l.outputTokens;
      const regularTokens = Math.max(0, totalTokens - cacheTokens);
      const originalCost = computeOriginal(l.cost, discount);
      const savings = originalCost - l.cost;
      const cacheSavingsRaw = meta ? (cacheTokens / 1_000_000) * meta.inputPrice : 0;
      const cacheSavings = cacheSavingsRaw * (discount > 0 ? 1 - discount / 100 : 1);
      return {
        ...l,
        meta,
        discount,
        cacheTokens,
        totalTokens,
        regularTokens,
        originalCost,
        savings,
        cacheSavings,
      };
    });
  }, [logs, modelMap]);

  const inRange = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - (range - 1));
    start.setHours(0, 0, 0, 0);
    return enriched.filter((l) => new Date(l.createdAt) >= start);
  }, [enriched, range]);

  // top stats — counted across ALL data (not range-bounded), per screenshot which shows totals
  const allStats = useMemo(() => {
    const totalRequests = enriched.length;
    const totalTokens = enriched.reduce((s, l) => s + l.totalTokens, 0);
    const totalCacheTokens = enriched.reduce((s, l) => s + l.cacheTokens, 0);
    const totalCost = enriched.reduce((s, l) => s + l.cost, 0);
    const totalOriginal = enriched.reduce((s, l) => s + l.originalCost, 0);
    const totalSavings = totalOriginal - totalCost;
    const totalCacheSavings = enriched.reduce((s, l) => s + l.cacheSavings, 0);
    const cacheHitPct = totalTokens > 0 ? (totalCacheTokens / totalTokens) * 100 : 0;
    const savingsPct = totalOriginal > 0 ? (totalSavings / totalOriginal) * 100 : 0;
    const cachedRequests = enriched.filter((l) => l.cacheTokens > 0).length;
    return { totalRequests, totalTokens, totalCacheTokens, totalCost, totalOriginal, totalSavings, totalCacheSavings, cacheHitPct, savingsPct, cachedRequests };
  }, [enriched]);

  const rangeStats = useMemo(() => {
    const tokens = inRange.reduce((s, l) => s + l.totalTokens, 0);
    const cost = inRange.reduce((s, l) => s + l.cost, 0);
    return { tokens, cost, requests: inRange.length };
  }, [inRange]);

  // daily buckets for chart
  const chartData = useMemo(() => {
    const days: { day: string; key: string; cache: number; regular: number; cost: number; requests: number }[] = [];
    const start = new Date();
    start.setDate(start.getDate() - (range - 1));
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < range; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      days.push({ day: formatShortDate(d), key, cache: 0, regular: 0, cost: 0, requests: 0 });
    }
    const byKey = new Map(days.map((d) => [d.key, d]));
    for (const l of inRange) {
      const key = new Date(l.createdAt).toISOString().slice(0, 10);
      const bucket = byKey.get(key);
      if (!bucket) continue;
      bucket.cache += l.cacheTokens;
      bucket.regular += l.regularTokens;
      bucket.cost += l.cost;
      bucket.requests += 1;
    }
    return days;
  }, [inRange, range]);

  // per-model breakdown
  const byModel = useMemo(() => {
    const map = new Map<string, { slug: string; displayName: string; provider: string; requests: number; tokens: number; cost: number }>();
    for (const l of enriched) {
      const cur = map.get(l.modelSlug) || {
        slug: l.modelSlug,
        displayName: l.meta?.displayName || l.modelSlug,
        provider: l.meta?.provider || "unknown",
        requests: 0,
        tokens: 0,
        cost: 0,
      };
      cur.requests += 1;
      cur.tokens += l.totalTokens;
      cur.cost += l.cost;
      map.set(l.modelSlug, cur);
    }
    const list = Array.from(map.values()).sort((a, b) => b.tokens - a.tokens);
    const totalTokens = list.reduce((s, m) => s + m.tokens, 0);
    return list.map((m) => ({ ...m, pct: totalTokens > 0 ? (m.tokens / totalTokens) * 100 : 0 }));
  }, [enriched]);

  // forecast — month end
  const forecast = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthSpent = enriched
      .filter((l) => new Date(l.createdAt) >= monthStart)
      .reduce((s, l) => s + l.cost, 0);
    const daysElapsed = now.getDate();
    const totalDays = daysInMonth(now);
    const projected = daysElapsed > 0 ? (monthSpent / daysElapsed) * totalDays : 0;
    return {
      monthSpent,
      projected,
      pct: projected > 0 ? Math.min(100, (monthSpent / projected) * 100) : 0,
      monthEndLabel: `${totalDays}/${(now.getMonth() + 1).toString().padStart(2, "0")}`,
    };
  }, [enriched]);

  const avgCost = useMemo(() => {
    if (enriched.length === 0) return { avg: 0, requests: 0 };
    return { avg: allStats.totalCost / allStats.totalRequests, requests: allStats.totalRequests };
  }, [allStats, enriched.length]);

  // detail table — filtered by status
  const detailRows = useMemo(() => {
    let rows = enriched.slice();
    if (statusFilter === "ok") rows = rows.filter((l) => l.status === 200);
    if (statusFilter === "fail") rows = rows.filter((l) => l.status !== 200);
    return rows.slice(0, 50);
  }, [enriched, statusFilter]);

  function exportCsv() {
    const header = "Thoi gian,Model,Provider,Input,Output,Cache,Tong,Discount,Original,Chi phi,Status\n";
    const rows = enriched.map((l) =>
      [
        new Date(l.createdAt).toISOString(),
        l.modelSlug,
        l.meta?.provider || "",
        l.inputTokens,
        l.outputTokens,
        l.cacheTokens,
        l.totalTokens,
        l.discount,
        l.originalCost.toFixed(4),
        l.cost.toFixed(4),
        l.status,
      ].join(","),
    );
    const csv = header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Sử dụng chi tiết</h1>
        <p className="text-sm text-ink-200/60">Phân tích chi tiết lịch sử sử dụng API của bạn</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={<Hash size={14} className="text-ink-200/50" />}
          title="Tổng Requests"
          value={formatNumber(allStats.totalRequests)}
          subtitle="API calls"
        />
        <StatCard
          icon={<Zap size={14} className="text-honey-300" />}
          title="Tổng Tokens"
          value={formatNumber(allStats.totalTokens)}
          valueClass="text-honey-300"
          subtitle={`${range} ngày: ${formatNumber(rangeStats.tokens)}`}
        />
        <StatCard
          icon={<CreditCard size={14} className="text-rose-300" />}
          title="Tổng Chi phí"
          value={formatVND(Math.round(allStats.totalCost))}
          valueClass="text-rose-300"
          subtitle={`${range} ngày: ${formatVND(Math.round(rangeStats.cost))}`}
        />
        <StatCard
          icon={<TrendingUp size={14} className="text-emerald-300" />}
          title="Cache Hit"
          value={`${allStats.cacheHitPct.toFixed(1)}%`}
          valueClass="text-emerald-300"
          subtitle={`${formatNumber(allStats.totalCacheTokens)} / ${formatNumber(allStats.totalTokens)} tokens`}
        />
        <StatCard
          icon={<Sparkles size={14} className="text-sky-300" />}
          title="AG + Codex Tiết kiệm"
          value={formatVND(Math.round(allStats.totalCacheSavings))}
          valueClass="text-sky-300"
          subtitle={
            <span className="inline-flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-0.5"><Sparkles size={9} /> {allStats.cachedRequests}</span>
              <span className="inline-flex items-center gap-0.5">· <Zap size={9} /> {formatNumber(allStats.totalCacheTokens)} tokens</span>
            </span>
          }
        />
        <StatCard
          icon={<PiggyBank size={14} className="text-emerald-300" />}
          title="Tổng Tiết kiệm"
          value={formatVND(Math.round(allStats.totalSavings))}
          valueClass="text-emerald-300"
          subtitle={
            <span className="inline-flex items-center gap-1 text-emerald-300/80">
              ↓ {allStats.savingsPct.toFixed(1)}% so với giá gốc
            </span>
          }
        />
      </div>

      {/* Chart + side panels */}
      <div className="grid lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)] gap-5">
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
            <div>
              <h2 className="text-base font-semibold">Biểu đồ sử dụng ({range} ngày)</h2>
              <div className="flex items-center gap-3 mt-2 text-xs text-ink-200/60 flex-wrap">
                <LegendDot color="#10b981" label="Cache Hit" />
                <LegendDot color="#3b82f6" label="Regular" />
                <LegendDot color="#ef4444" label="Chi phí (VND)" />
                <span className="inline-flex items-center gap-1.5 text-purple-300">
                  <svg width="18" height="2"><line x1="0" y1="1" x2="18" y2="1" stroke="#a855f7" strokeWidth="2" /></svg>
                  Requests
                </span>
              </div>
            </div>
            <div className="flex p-0.5 rounded-lg bg-ink-950/60 border border-white/5 text-xs">
              {([7, 30, 90] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded-md transition ${
                    range === r ? "bg-honey-500/15 text-honey-200 border border-honey-500/30" : "text-ink-200/60 hover:text-white"
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <YAxis yAxisId="left" stroke="#60a5fa" fontSize={11} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <YAxis yAxisId="right" orientation="right" stroke="#f87171" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "#fbbf24", fontWeight: 600 }}
                  formatter={(value: number, name: string) => {
                    if (name === "Chi phí") return [`${formatVND(Math.round(value))}`, name];
                    if (name === "Requests") return [formatNumber(value), name];
                    return [`${formatNumber(value)} tokens`, name];
                  }}
                />
                <Bar yAxisId="left" dataKey="cache" name="Cache Hit" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="regular" name="Regular" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="cost" name="Chi phí" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="requests" name="Requests" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 text-sm text-ink-200/70">
              <TrendingUp size={14} className="text-honey-300" />
              <span>Dự báo cuối tháng</span>
            </div>
            <p className="text-[11px] text-ink-200/50 mt-0.5">Ngày {forecast.monthEndLabel}</p>
            <p className="text-2xl font-bold text-honey-300 mt-2">{formatVND(Math.round(forecast.projected))}</p>
            <p className="text-xs text-ink-200/60 mt-1">Đã chi: {formatVND(Math.round(forecast.monthSpent))}</p>
            <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-honey-500 to-rose-500" style={{ width: `${forecast.pct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-ink-200/40 mt-1">
              <span>Ngày 1</span>
              <span>Ngày {daysInMonth(new Date())}</span>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 text-sm text-ink-200/70">
              <CreditCard size={14} className="text-purple-300" />
              <span>Chi phí TB / Request</span>
            </div>
            <p className="text-[11px] text-ink-200/50 mt-0.5">{avgCost.requests} requests</p>
            <p className="text-2xl font-bold text-purple-300 mt-2">{formatVND(Math.round(avgCost.avg))}</p>
            <p className="text-xs text-ink-200/50 mt-2">
              {avgCost.requests < 2 ? "Cần ít nhất 2 ngày dữ liệu để có ý nghĩa" : "Trung bình toàn bộ thời gian"}
            </p>
          </div>
        </div>
      </div>

      {/* Model breakdown + donut */}
      <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
        <div className="card p-5">
          <h2 className="text-base font-semibold">Phân tích theo Model</h2>
          <p className="text-xs text-ink-200/50 mb-4">Chi tiết sử dụng từng model AI</p>
          {byModel.length === 0 ? (
            <p className="text-sm text-ink-200/40 text-center py-8">Chưa có dữ liệu</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-ink-200/50">
                    <th className="text-left font-medium py-2">Model</th>
                    <th className="text-right font-medium py-2">Requests</th>
                    <th className="text-right font-medium py-2">Tokens</th>
                    <th className="text-right font-medium py-2">Chi phí</th>
                    <th className="text-right font-medium py-2 pl-4">%</th>
                  </tr>
                </thead>
                <tbody>
                  {byModel.map((m) => (
                    <tr key={m.slug} className="border-t border-white/5">
                      <td className="py-2.5">
                        <p className="font-medium">{m.displayName}</p>
                        <p className="text-[11px] text-ink-200/40">{m.provider}</p>
                      </td>
                      <td className="text-right">{formatNumber(m.requests)}</td>
                      <td className="text-right">{formatNumber(m.tokens)}</td>
                      <td className="text-right">{formatVND(Math.round(m.cost))}</td>
                      <td className="text-right pl-4 min-w-[120px]">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full bg-purple-400" style={{ width: `${m.pct}%` }} />
                          </div>
                          <span className="text-xs text-ink-200/70 w-10">{m.pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-base font-semibold">Phân bổ Tokens</h2>
          <p className="text-xs text-ink-200/50 mb-2">Tỷ lệ sử dụng theo model</p>
          {byModel.length === 0 ? (
            <p className="text-sm text-ink-200/40 text-center py-12">Chưa có dữ liệu</p>
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byModel} dataKey="tokens" nameKey="displayName" innerRadius={42} outerRadius={70} paddingAngle={2}>
                      {byModel.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                      formatter={(value: number) => [`${formatNumber(value)} tokens`, ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 mt-2">
                {byModel.slice(0, 5).map((m, i) => (
                  <li key={m.slug} className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate">{m.displayName}</span>
                    </span>
                    <span className="text-ink-200/60 shrink-0">{m.pct.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Detail table */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="text-base font-semibold">Lịch sử sử dụng</h2>
            <p className="text-xs text-ink-200/50">Chi tiết các request API gần đây ({detailRows.length} records)</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex p-0.5 rounded-lg bg-ink-950/60 border border-white/5 text-xs">
              {([
                { k: "all", label: "Tất cả" },
                { k: "ok", label: "Thành công" },
                { k: "fail", label: "Lỗi" },
              ] as const).map((f) => (
                <button
                  key={f.k}
                  onClick={() => setStatusFilter(f.k)}
                  className={`px-3 py-1.5 rounded-md transition ${
                    statusFilter === f.k ? "bg-honey-500/15 text-honey-200 border border-honey-500/30" : "text-ink-200/60 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={exportCsv} className="btn btn-ghost text-xs">
              <Download size={12} /> Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-200/50 border-b border-white/5">
                <th className="text-left font-medium py-2.5 px-2 w-16">Status</th>
                <th className="text-left font-medium py-2.5 px-2">Ngày</th>
                <th className="text-left font-medium py-2.5 px-2">Nhà cung cấp</th>
                <th className="text-left font-medium py-2.5 px-2">Mô hình</th>
                <th className="text-right font-medium py-2.5 px-2">Input</th>
                <th className="text-right font-medium py-2.5 px-2">Output</th>
                <th className="text-right font-medium py-2.5 px-2">Cache Hit</th>
                <th className="text-right font-medium py-2.5 px-2">Tổng</th>
                <th className="text-right font-medium py-2.5 px-2">Chi phí</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-ink-200/50">Không có dữ liệu</td></tr>
              ) : detailRows.map((l) => (
                <tr key={l.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-2.5 px-2">
                    {l.status === 200 ? (
                      <CheckCircle2 size={15} className="text-emerald-400" />
                    ) : (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold">!</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-ink-200/70 whitespace-nowrap text-xs">{formatDateTime(l.createdAt)}</td>
                  <td className="py-2.5 px-2">
                    <span className="inline-flex items-center gap-1.5 text-honey-300 text-xs">
                      <span className="w-4 h-4 rounded bg-honey-500/15 border border-honey-500/30 flex items-center justify-center text-[9px]">🐝</span>
                      QUANGTHUONG
                    </span>
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-xs">{l.meta?.displayName || l.modelSlug}</span>
                      {l.discount > 0 && (
                        <span className="badge bg-rose-500/15 text-rose-200 text-[10px]">🔥 −{l.discount}%</span>
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right text-xs">{formatNumber(l.inputTokens)}</td>
                  <td className="py-2.5 px-2 text-right text-xs">{formatNumber(l.outputTokens)}</td>
                  <td className="py-2.5 px-2 text-right text-xs">
                    {l.cacheTokens > 0 ? <span className="text-emerald-300">{formatNumber(l.cacheTokens)}</span> : <span className="text-ink-200/30">—</span>}
                  </td>
                  <td className="py-2.5 px-2 text-right text-xs font-medium">{formatNumber(l.totalTokens)}</td>
                  <td className="py-2.5 px-2 text-right text-xs whitespace-nowrap">
                    {l.discount > 0 && l.originalCost > l.cost && (
                      <span className="text-ink-200/40 line-through mr-1">{formatVND(Math.round(l.originalCost * 100) / 100)}</span>
                    )}
                    <span className={l.cost > 0 ? "text-rose-300 font-medium" : "text-ink-200/40"}>{formatVND(Math.round(l.cost * 100) / 100)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  valueClass,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  valueClass?: string;
  subtitle: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-ink-200/60">{title}</p>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${valueClass ?? ""}`}>{value}</p>
      <div className="text-[11px] text-ink-200/50 mt-1">{subtitle}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </span>
  );
}
