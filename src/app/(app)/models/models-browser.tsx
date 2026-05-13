"use client";
import { useState, useMemo } from "react";
import { Zap, Clock, Search } from "lucide-react";
import { formatNumber, formatUSD } from "@/lib/format";
import { CopySlug } from "./copy-slug";

type ModelItem = {
  id: string;
  slug: string;
  displayName: string;
  provider: string;
  category: string;
  priceUnit: string;
  inputPrice: number;
  outputPrice: number;
  contextLength: number;
  description: string | null;
  freeDiscount: number;
  basicDiscount: number;
  advDiscount: number;
  speedTps: number;
  latencyMs: number;
  uptimeStatus: string;
};

const PROVIDER_COLOR: Record<string, string> = {
  openai: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  anthropic: "bg-orange-500/15 text-orange-300 border-orange-500/20",
  google: "bg-sky-500/15 text-sky-300 border-sky-500/20",
  deepseek: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  grok: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/20",
  meta: "bg-indigo-500/15 text-indigo-300 border-indigo-500/20",
  mistral: "bg-rose-500/15 text-rose-300 border-rose-500/20",
  other: "bg-slate-500/15 text-slate-300 border-slate-500/20",
};

const PROVIDER_ACTIVE: Record<string, string> = {
  openai: "bg-emerald-500/30 text-emerald-100 border-emerald-400/60 ring-1 ring-emerald-400/40",
  anthropic: "bg-orange-500/30 text-orange-100 border-orange-400/60 ring-1 ring-orange-400/40",
  google: "bg-sky-500/30 text-sky-100 border-sky-400/60 ring-1 ring-sky-400/40",
  deepseek: "bg-blue-500/30 text-blue-100 border-blue-400/60 ring-1 ring-blue-400/40",
  grok: "bg-fuchsia-500/30 text-fuchsia-100 border-fuchsia-400/60 ring-1 ring-fuchsia-400/40",
  meta: "bg-indigo-500/30 text-indigo-100 border-indigo-400/60 ring-1 ring-indigo-400/40",
  mistral: "bg-rose-500/30 text-rose-100 border-rose-400/60 ring-1 ring-rose-400/40",
  other: "bg-slate-500/30 text-slate-100 border-slate-400/60 ring-1 ring-slate-400/40",
};

const UPTIME_STYLE: Record<string, { dot: string; label: string }> = {
  good: { dot: "bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/70", label: "Hoạt động tốt" },
  warn: { dot: "bg-amber-400 shadow-[0_0_6px] shadow-amber-400/70", label: "Không ổn định" },
  down: { dot: "bg-rose-400 shadow-[0_0_6px] shadow-rose-400/70", label: "Đang gián đoạn" },
};

const SORTS = [
  { value: "name", label: "Tên A → Z" },
  { value: "price-asc", label: "Giá thấp → cao" },
  { value: "price-desc", label: "Giá cao → thấp" },
  { value: "context", label: "Context dài nhất" },
  { value: "speed", label: "Tốc độ nhanh nhất" },
] as const;

type SortKey = (typeof SORTS)[number]["value"];

export function ModelsBrowser({
  models,
  providers,
  title,
  subtitle,
  showOutput = true,
  showContext = true,
}: {
  models: ModelItem[];
  providers: string[];
  title?: string;
  subtitle?: string;
  showOutput?: boolean;
  showContext?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  const toggle = (p: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = models.filter((m) => {
      if (selected.size > 0 && !selected.has(m.provider)) return false;
      if (q && !`${m.displayName} ${m.slug} ${m.provider}`.toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "price-asc": return a.inputPrice - b.inputPrice;
        case "price-desc": return b.inputPrice - a.inputPrice;
        case "context": return b.contextLength - a.contextLength;
        case "speed": return (b.speedTps || 0) - (a.speedTps || 0);
        default: return a.displayName.localeCompare(b.displayName);
      }
    });
    return list;
  }, [models, selected, search, sort]);

  const countByProvider = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of models) c[m.provider] = (c[m.provider] || 0) + 1;
    return c;
  }, [models]);

  const visibleSorts = showContext ? SORTS : SORTS.filter((s) => s.value !== "context");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title ?? "Models khả dụng"}</h1>
        <p className="text-sm text-ink-200/60">
          {subtitle ?? `${models.length} model từ ${providers.length} provider. Giá tính theo VND (đã quy đổi từ USD).`}
        </p>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setSelected(new Set())}
            className={`badge border transition ${
              selected.size === 0
                ? "bg-honey-500/30 text-honey-100 border-honey-400/60 ring-1 ring-honey-400/40"
                : "bg-white/5 text-ink-200/70 border-white/10 hover:bg-white/10"
            }`}
          >
            Tất cả <span className="ml-1 text-[10px] opacity-70">({models.length})</span>
          </button>
          {providers.map((p) => {
            const active = selected.has(p);
            return (
              <button
                key={p}
                onClick={() => toggle(p)}
                className={`badge border transition ${
                  active
                    ? PROVIDER_ACTIVE[p] ?? "bg-white/20 border-white/40"
                    : `${PROVIDER_COLOR[p] ?? "bg-white/5"} border opacity-80 hover:opacity-100`
                }`}
              >
                {p} <span className="ml-1 text-[10px] opacity-70">({countByProvider[p]})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-200/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên model, slug..."
              className="input pl-9"
            />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input w-auto">
            {visibleSorts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <p className="text-xs text-ink-200/50">
        Hiển thị {filtered.length} / {models.length} model
        {selected.size > 0 && ` — đã lọc theo ${[...selected].join(", ")}`}
      </p>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-ink-200/50">
          Không có model nào khớp bộ lọc.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const uptime = UPTIME_STYLE[m.uptimeStatus] ?? UPTIME_STYLE.good;
            const unitShort = m.priceUnit === "1M tokens" ? "/1M" : `/${m.priceUnit}`;
            return (
              <div key={m.id} className="card p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold truncate">{m.displayName}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <button
                        onClick={() => setSelected(new Set([m.provider]))}
                        className={`badge border ${PROVIDER_COLOR[m.provider] ?? "bg-white/5"} hover:opacity-80`}
                        title={`Lọc theo ${m.provider}`}
                      >
                        {m.provider}
                      </button>
                      <span className="inline-flex items-center gap-1.5 text-xs text-ink-200/60" title={uptime.label}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${uptime.dot}`} />
                        {uptime.label}
                      </span>
                    </div>
                  </div>
                </div>

                {m.description && <p className="text-sm text-ink-200/60 mb-4 flex-1">{m.description}</p>}

                <div className="space-y-1 text-sm mb-3">
                  <div className="flex justify-between">
                    <span className="text-ink-200/50">{showOutput ? "Input" : "Giá"}</span>
                    <span className="text-honey-300">{formatUSD(m.inputPrice)}{unitShort}</span>
                  </div>
                  {showOutput && m.outputPrice > 0 && (
                    <div className="flex justify-between">
                      <span className="text-ink-200/50">Output</span>
                      <span className="text-honey-300">{formatUSD(m.outputPrice)}{unitShort}</span>
                    </div>
                  )}
                  {showContext && m.contextLength > 0 && (
                    <div className="flex justify-between"><span className="text-ink-200/50">Context</span><span>{formatNumber(m.contextLength)} tokens</span></div>
                  )}
                </div>

                {(m.speedTps > 0 || m.latencyMs > 0) && (
                  <div className="flex items-center gap-3 text-xs text-ink-200/60 mb-3">
                    {m.speedTps > 0 && (
                      <span className="inline-flex items-center gap-1"><Zap size={11} className="text-honey-300" />{m.speedTps} tok/s</span>
                    )}
                    {m.latencyMs > 0 && (
                      <span className="inline-flex items-center gap-1"><Clock size={11} className="text-ink-200/60" />{(m.latencyMs / 1000).toFixed(m.latencyMs >= 1000 ? 1 : 2)}s</span>
                    )}
                  </div>
                )}

                <CopySlug slug={m.slug} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
