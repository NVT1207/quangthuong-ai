"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Search, X, AlertCircle, Loader2, Check, Link2, Copy, DollarSign, Hash,
  TrendingUp, Clock, Activity,
} from "lucide-react";
import { formatUSD, formatNumber } from "@/lib/format";

type ModelInfo = {
  id: string; slug: string; displayName: string; provider: string; category: string;
  contextLength: number; inputPrice: number; outputPrice: number; priceUnit: string; active?: boolean;
};

type Subscription = {
  id: string;
  modelId: string;
  enabled: boolean;
  createdAt: string;
  model: ModelInfo;
  stats: { totalRequests: number; totalCost: number; totalInputTokens: number; totalOutputTokens: number; successCount?: number; avgLatencyMs?: number; lastUsedAt?: string | null };
};

const CAT_LABEL: Record<string, string> = {
  text: "Text", embedding: "Embedding", image: "Image", video: "Video", tts: "TTS",
};

const CAT_COLOR: Record<string, string> = {
  text: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  embedding: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  image: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  video: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  tts: "border-honey-500/30 bg-honey-500/10 text-honey-300",
};

const PROVIDER_COLOR: Record<string, string> = {
  openai: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  anthropic: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  google: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  gemini: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  meta: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  xai: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  deepseek: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  mistral: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  cohere: "border-pink-500/30 bg-pink-500/10 text-pink-300",
};

function providerCls(p: string) {
  const k = p?.toLowerCase() ?? "";
  return PROVIDER_COLOR[k] || "border-violet-500/30 bg-violet-500/10 text-violet-300";
}

function timeAgo(iso?: string | null): string {
  if (!iso) return "Chưa dùng";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return iso;
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return `${s}s trước`;
  if (s < 3600) return `${Math.floor(s / 60)}p trước`;
  if (s < 86400) return `${Math.floor(s / 3600)}h trước`;
  return `${Math.floor(s / 86400)}d trước`;
}

export function ModelsTab({
  keyId,
  onCountChange,
  addSignal,
}: {
  keyId: string;
  onCountChange?: (n: number) => void;
  addSignal?: number;
}) {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/keys/${keyId}/models`);
    const d = await r.json().catch(() => ({}));
    setSubs(d.items ?? []);
    setLoading(false);
    onCountChange?.(d.items?.length ?? 0);
  }, [keyId, onCountChange]);

  useEffect(() => { load(); }, [load]);

  // Mở picker khi addSignal thay đổi (từ nút "+ Thêm Model mới" trong header modal)
  useEffect(() => {
    if (typeof addSignal === "number" && addSignal > 0) setAddOpen(true);
  }, [addSignal]);

  async function toggle(modelId: string, enabled: boolean) {
    setSubs((p) => p.map((s) => (s.modelId === modelId ? { ...s, enabled } : s)));
    const r = await fetch(`/api/keys/${keyId}/models/${modelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!r.ok) {
      setSubs((p) => p.map((s) => (s.modelId === modelId ? { ...s, enabled: !enabled } : s)));
    }
  }

  async function remove(modelId: string, name: string) {
    if (!confirm(`Bỏ subscribe model "${name}" khỏi key này?`)) return;
    const r = await fetch(`/api/keys/${keyId}/models/${modelId}`, { method: "DELETE" });
    if (r.ok) {
      setSubs((p) => p.filter((s) => s.modelId !== modelId));
      onCountChange?.(subs.length - 1);
    }
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="py-14 text-center text-ink-200/40 text-sm flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Đang tải...
        </div>
      ) : subs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-ink-950/30 py-14 text-center">
          <AlertCircle className="mx-auto text-ink-200/30 mb-2" size={28} />
          <p className="text-sm text-ink-200/55">Key này chưa subscribe model nào.</p>
          <p className="text-xs text-ink-200/40 mt-1">Bấm "+ Thêm Model mới" ở góc trên để chọn từ danh sách model có sẵn.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {subs.map((s) => (
            <SubscriptionRow
              key={s.id}
              sub={s}
              onToggle={(v) => toggle(s.modelId, v)}
              onRemove={() => remove(s.modelId, s.model.displayName)}
            />
          ))}
        </div>
      )}

      {addOpen && (
        <AddModelPicker
          keyId={keyId}
          onClose={() => setAddOpen(false)}
          onAdded={() => { setAddOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function SubscriptionRow({
  sub,
  onToggle,
  onRemove,
}: {
  sub: Subscription;
  onToggle: (v: boolean) => void;
  onRemove: () => void;
}) {
  const m = sub.model;
  const cat = CAT_LABEL[m.category] || m.category;
  const catCls = CAT_COLOR[m.category] || "border-white/10 bg-white/5 text-ink-200/70";
  const provCls = providerCls(m.provider);
  const successRate = sub.stats.totalRequests > 0 && sub.stats.successCount != null
    ? Math.round((sub.stats.successCount / sub.stats.totalRequests) * 100)
    : (sub.stats.totalRequests > 0 ? 100 : 0);
  const totalTokens = sub.stats.totalInputTokens + sub.stats.totalOutputTokens;

  return (
    <div className="rounded-xl border border-white/5 bg-ink-950/40 p-4 hover:border-white/15 transition">
      <div className="flex items-start gap-3">
        {/* Icon box left */}
        <div className="w-10 h-10 rounded-xl bg-honey-500/10 border border-honey-500/20 flex items-center justify-center shrink-0">
          <Link2 size={18} className="text-honey-300" />
        </div>

        {/* Content middle */}
        <div className="flex-1 min-w-0">
          {/* Header line: slug + copy + Active + provider + category */}
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-sm font-mono font-semibold text-ink-100 truncate">{m.slug}</code>
            <button
              onClick={() => navigator.clipboard.writeText(m.slug).catch(() => {})}
              className="p-0.5 rounded text-ink-200/40 hover:text-ink-100 hover:bg-white/5 transition"
              title="Copy slug"
            >
              <Copy size={12} />
            </button>
            {sub.enabled ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                Active
              </span>
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300">
                Tắt
              </span>
            )}
            <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${provCls}`}>
              {m.provider}
            </span>
            <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${catCls}`}>
              {cat}
            </span>
            {/* Toggle micro */}
            <button
              onClick={() => onToggle(!sub.enabled)}
              className="ml-1 text-[10px] text-ink-200/45 hover:text-sky-300 transition"
              title={sub.enabled ? "Tắt subscribe" : "Bật subscribe"}
            >
              [{sub.enabled ? "tắt" : "bật"}]
            </button>
          </div>

          {/* Sub-line: model name */}
          <div className="mt-1 text-xs text-ink-200/65 truncate">
            <span className="text-ink-200/45">Tên hiển thị:</span>{" "}
            <span className="text-ink-100/85">{m.displayName}</span>
          </div>

          {/* Price line */}
          <div className="mt-0.5 text-[11px] text-ink-200/55 flex items-center gap-1 flex-wrap">
            <span>${m.inputPrice}/{m.priceUnit} input</span>
            <span className="text-ink-200/30">·</span>
            <span>${m.outputPrice}/{m.priceUnit} output</span>
            {m.contextLength > 0 && (
              <>
                <span className="text-ink-200/30">·</span>
                <span>{formatNumber(m.contextLength)} ctx</span>
              </>
            )}
          </div>

          {/* Đăng ký line */}
          <div className="mt-0.5 text-[11px] text-ink-200/45">
            Đăng ký: {sub.createdAt ? new Date(sub.createdAt).toLocaleString("vi-VN") : "—"}
          </div>

          {/* Stats footer */}
          <div className="mt-2.5 flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] font-mono">
            <Metric icon={<Link2 size={11} />} value={`${formatNumber(sub.stats.totalRequests)} req`} />
            <Metric
              icon={<TrendingUp size={11} />}
              value={`${successRate}%`}
              tone={successRate >= 95 ? "emerald" : successRate >= 80 ? "honey" : "rose"}
            />
            <Metric icon={<DollarSign size={11} />} value={formatUSD(sub.stats.totalCost)} tone="emerald" />
            <Metric icon={<Hash size={11} />} value={formatNumber(totalTokens)} />
            {sub.stats.avgLatencyMs != null && sub.stats.avgLatencyMs > 0 && (
              <Metric icon={<Activity size={11} />} value={`${Math.round(sub.stats.avgLatencyMs)}ms`} />
            )}
            <Metric icon={<Clock size={11} />} value={timeAgo(sub.stats.lastUsedAt)} />
          </div>
        </div>

        {/* Right: Hủy red text-link */}
        <div className="shrink-0">
          <button
            onClick={onRemove}
            className="text-sm font-medium text-rose-300/85 hover:text-rose-200 hover:underline transition"
            title="Bỏ subscribe"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, value, tone }: { icon: React.ReactNode; value: string; tone?: "emerald" | "honey" | "rose" }) {
  const cls =
    tone === "emerald" ? "text-emerald-300/85"
    : tone === "honey" ? "text-honey-300/85"
    : tone === "rose" ? "text-rose-300/85"
    : "text-ink-200/65";
  return (
    <span className={`inline-flex items-center gap-1 ${cls}`}>
      <span className="text-ink-200/40">{icon}</span>
      {value}
    </span>
  );
}

function AddModelPicker({ keyId, onClose, onAdded }: { keyId: string; onClose: () => void; onAdded: () => void }) {
  const [items, setItems] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (cat) params.set("category", cat);
    const t = setTimeout(() => {
      fetch(`/api/keys/${keyId}/available-models?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => setItems(d.items ?? []))
        .finally(() => setLoading(false));
    }, q ? 200 : 0);
    return () => clearTimeout(t);
  }, [keyId, q, cat]);

  function toggle(id: string) {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function save() {
    if (selected.size === 0) return;
    setSaving(true);
    const r = await fetch(`/api/keys/${keyId}/models`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelIds: Array.from(selected) }),
    });
    setSaving(false);
    if (r.ok) onAdded();
    else {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "Không thêm được");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-ink-900 border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/5">
          <div className="min-w-0">
            <p className="text-xs font-mono uppercase tracking-wider text-ink-200/40">Thêm Model</p>
            <p className="text-base font-semibold truncate">Chọn model có sẵn từ admin</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-ink-200/60 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-200/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên / slug / provider..."
              className="input w-full pl-8 text-sm"
            />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="input text-sm">
            <option value="">Tất cả loại</option>
            <option value="text">Text</option>
            <option value="embedding">Embedding</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="tts">TTS</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
          {loading ? (
            <div className="py-10 text-center text-ink-200/40 text-sm flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Đang tải...
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-ink-200/40 text-sm">
              Không tìm thấy model phù hợp.{" "}
              <span className="text-ink-200/30">(Có thể đã subscribe hết)</span>
            </div>
          ) : (
            items.map((m) => {
              const sel = selected.has(m.id);
              const cls = CAT_COLOR[m.category] || "border-white/10 bg-white/5 text-ink-200/70";
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition flex items-center gap-3 ${
                    sel
                      ? "border-sky-400/60 bg-sky-500/10"
                      : "border-white/5 bg-ink-950/30 hover:border-white/15"
                  }`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                    sel ? "border-sky-400 bg-sky-500" : "border-white/20"
                  }`}>
                    {sel && <Check size={12} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{m.displayName}</span>
                      <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${cls}`}>
                        {CAT_LABEL[m.category] || m.category}
                      </span>
                      <span className="text-[10px] font-mono uppercase text-ink-200/40">{m.provider}</span>
                    </div>
                    <div className="text-[11px] font-mono text-ink-200/45 truncate">{m.slug}</div>
                    <div className="mt-0.5 text-[11px] text-ink-200/55">
                      In ${m.inputPrice}/{m.priceUnit} · Out ${m.outputPrice}/{m.priceUnit}
                      {m.contextLength > 0 && ` · ${formatNumber(m.contextLength)} ctx`}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-white/5">
          <p className="text-xs text-ink-200/55">{selected.size} model đã chọn</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn btn-ghost text-sm">Hủy</button>
            <button
              onClick={save}
              disabled={selected.size === 0 || saving}
              className={
                selected.size === 0 || saving
                  ? "px-4 py-2 rounded-xl text-sm font-medium bg-ink-950/40 text-ink-200/35 border border-white/5 cursor-not-allowed"
                  : "px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-md shadow-sky-500/20 hover:from-sky-400 hover:to-violet-400 transition"
              }
            >
              {saving ? "Đang thêm..." : `Thêm ${selected.size} model`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
