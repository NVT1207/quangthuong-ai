"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Search, X, AlertCircle, Loader2, Check } from "lucide-react";
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
  stats: { totalRequests: number; totalCost: number; totalInputTokens: number; totalOutputTokens: number };
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

export function ModelsTab({ keyId, onCountChange }: { keyId: string; onCountChange?: (n: number) => void }) {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink-200/70">
          <span>Đã subscribe <span className="font-semibold text-ink-100">{subs.length}</span> model</span>
          {subs.some((s) => !s.enabled) && (
            <span className="text-[11px] px-2 py-0.5 rounded border border-honey-500/30 bg-honey-500/10 text-honey-300">
              {subs.filter((s) => !s.enabled).length} đang tắt
            </span>
          )}
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-md shadow-sky-500/20 hover:from-sky-400 hover:to-violet-400 transition"
        >
          <Plus size={13} /> Thêm Model
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-ink-200/40 text-sm flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Đang tải...
        </div>
      ) : subs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-ink-950/30 py-10 text-center">
          <AlertCircle className="mx-auto text-ink-200/30 mb-2" size={28} />
          <p className="text-sm text-ink-200/55">Key này chưa subscribe model nào.</p>
          <p className="text-xs text-ink-200/40 mt-1">Bấm "Thêm Model" để chọn từ danh sách model có sẵn.</p>
        </div>
      ) : (
        <div className="space-y-2">
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

function SubscriptionRow({ sub, onToggle, onRemove }: { sub: Subscription; onToggle: (v: boolean) => void; onRemove: () => void }) {
  const m = sub.model;
  const cat = CAT_LABEL[m.category] || m.category;
  const catCls = CAT_COLOR[m.category] || "border-white/10 bg-white/5 text-ink-200/70";
  return (
    <div className="rounded-xl border border-white/5 bg-ink-950/40 px-4 py-3 hover:border-white/15 transition">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{m.displayName}</span>
            <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${catCls}`}>{cat}</span>
            <span className="text-[10px] font-mono uppercase text-ink-200/40">{m.provider}</span>
            {!sub.enabled && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300">Tắt</span>
            )}
          </div>
          <div className="mt-1 text-[11px] font-mono text-ink-200/45 truncate">{m.slug}</div>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-ink-200/60">
            <span>{formatNumber(sub.stats.totalRequests)} req</span>
            <span className="text-emerald-300/80">{formatUSD(sub.stats.totalCost)}</span>
            <span>In ${m.inputPrice}/{m.priceUnit} · Out ${m.outputPrice}/{m.priceUnit}</span>
            {m.contextLength > 0 && <span>{formatNumber(m.contextLength)} ctx</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Toggle on={sub.enabled} onChange={onToggle} />
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg text-rose-300/70 hover:text-rose-300 hover:bg-rose-500/10 transition"
            title="Bỏ subscribe"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 rounded-full transition shrink-0 ${on ? "bg-emerald-500/80" : "bg-ink-700"}`}
      title={on ? "Đang bật" : "Đang tắt"}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
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
