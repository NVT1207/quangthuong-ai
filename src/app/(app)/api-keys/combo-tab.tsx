"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Combine, Plus, Check, Layers, Sparkles } from "lucide-react";
import { formatNumber } from "@/lib/format";

type ModelInfo = {
  id: string; slug: string; displayName: string; provider: string; category: string;
  inputPrice: number; outputPrice: number; priceUnit: string; contextLength: number;
};

type Combo = {
  key: string;
  name: string;
  desc: string;
  accent: string;
  items: ModelInfo[];
};

const PROVIDER_NAME: Record<string, string> = {
  openai: "OpenAI (GPT)", anthropic: "Anthropic (Claude)", google: "Google (Gemini)",
  gemini: "Google (Gemini)", xai: "xAI (Grok)", deepseek: "DeepSeek", meta: "Meta (Llama)",
  mistral: "Mistral", cohere: "Cohere",
};
const PROVIDER_ACCENT: Record<string, string> = {
  openai: "emerald", anthropic: "orange", google: "sky", gemini: "sky",
  xai: "violet", deepseek: "purple", meta: "blue", mistral: "amber", cohere: "pink",
};

function accentCls(a: string) {
  const map: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    orange: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    sky: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    pink: "border-pink-500/30 bg-pink-500/10 text-pink-300",
    honey: "border-honey-500/30 bg-honey-500/10 text-honey-300",
  };
  return map[a] || map.violet;
}

export function ComboTab({ keyId, onApplied }: { keyId: string; onApplied?: () => void }) {
  const [items, setItems] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/keys/${keyId}/available-models`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, [keyId]);

  useEffect(load, [load]);

  const combos = useMemo<Combo[]>(() => {
    const out: Combo[] = [];
    const text = items.filter((m) => m.category === "text");

    // Combo theo nhà cung cấp
    const byProvider = new Map<string, ModelInfo[]>();
    for (const m of items) {
      const k = (m.provider || "khác").toLowerCase();
      if (!byProvider.has(k)) byProvider.set(k, []);
      byProvider.get(k)!.push(m);
    }
    for (const [prov, list] of byProvider) {
      if (list.length < 2) continue; // combo phải có ≥2 model
      out.push({
        key: `prov:${prov}`,
        name: `Combo ${PROVIDER_NAME[prov] || prov}`,
        desc: `Tất cả ${list.length} model của ${PROVIDER_NAME[prov] || prov}`,
        accent: PROVIDER_ACCENT[prov] || "violet",
        items: list,
      });
    }

    // Combo tổng hợp
    if (text.length >= 2) {
      out.push({
        key: "all-text",
        name: "Combo Toàn Bộ Text",
        desc: `Tất cả ${text.length} model text (chat/completion) chưa đăng ký`,
        accent: "honey",
        items: text,
      });
      const cheap = [...text].sort((a, b) => a.inputPrice - b.inputPrice).slice(0, Math.min(5, text.length));
      out.push({
        key: "saver",
        name: "Combo Tiết Kiệm",
        desc: `${cheap.length} model text giá rẻ nhất — tối ưu chi phí`,
        accent: "emerald",
        items: cheap,
      });
    }

    return out;
  }, [items]);

  async function apply(combo: Combo) {
    if (applying) return;
    setApplying(combo.key);
    try {
      const r = await fetch(`/api/keys/${keyId}/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelIds: combo.items.map((m) => m.id) }),
      });
      if (r.ok) { load(); onApplied?.(); }
      else { const d = await r.json().catch(() => ({})); alert(d.error || "Không thêm được combo"); }
    } finally {
      setApplying(null);
    }
  }

  if (loading) {
    return <div className="py-14 text-center text-ink-200/40 text-sm flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Đang tải combo...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 flex items-start gap-2 text-sm text-ink-100/85">
        <Combine size={14} className="text-sky-300 mt-0.5 shrink-0" />
        <span className="flex-1">Đăng ký nhanh nhiều model cùng lúc cho key này theo từng combo. Combo chỉ hiện model <b>chưa đăng ký</b>.</span>
      </div>

      {combos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-ink-950/30 py-14 text-center">
          <Layers className="mx-auto text-ink-200/30 mb-2" size={28} />
          <p className="text-sm text-ink-200/55">Không có combo khả dụng.</p>
          <p className="text-xs text-ink-200/40 mt-1">Key đã đăng ký gần hết model, hoặc admin chưa thêm đủ model cùng nhóm.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {combos.map((c) => {
            const cls = accentCls(c.accent);
            const isApplying = applying === c.key;
            return (
              <div key={c.key} className={`rounded-2xl border bg-ink-950/40 p-4 flex flex-col gap-3 ${cls.split(" ")[0]}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${cls}`}>
                    <Sparkles size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{c.name}</p>
                    <p className="text-[11px] text-ink-200/55 mt-0.5">{c.desc}</p>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${cls}`}>{c.items.length} model</span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {c.items.slice(0, 6).map((m) => (
                    <span key={m.id} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-ink-200/65 truncate max-w-[140px]">
                      {m.slug}
                    </span>
                  ))}
                  {c.items.length > 6 && <span className="text-[10px] text-ink-200/45 px-1 py-0.5">+{c.items.length - 6} nữa</span>}
                </div>

                <button
                  onClick={() => apply(c)}
                  disabled={isApplying}
                  className="mt-auto w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-md shadow-sky-500/20 hover:from-sky-400 hover:to-violet-400 transition disabled:opacity-50"
                >
                  {isApplying ? <><Loader2 size={13} className="animate-spin" /> Đang thêm...</> : <><Plus size={13} /> Thêm {c.items.length} model</>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
