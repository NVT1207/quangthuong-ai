"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2, X, Loader2, Copy, ChevronDown, ChevronRight } from "lucide-react";
import { formatUSD, USD_VND_RATE } from "@/lib/format";

type M = {
  id: string; slug: string; displayName: string; provider: string;
  category: string; priceUnit: string;
  inputPrice: number; outputPrice: number; contextLength: number;
  description: string | null; active: boolean; createdAt: string;
  freeDiscount: number; basicDiscount: number; advDiscount: number;
  speedTps: number; latencyMs: number; uptimeStatus: string;
  providerId?: string | null;
  upstreamSlug?: string | null;
};

type ProviderKey = {
  id: string;
  label: string | null;
  enabled: boolean;
  plainKey: string;
};

type ProviderOpt = {
  id: string;
  name: string;
  type: string;
  baseUrl: string | null;
  routing: string;
  enabled: boolean;
  modelsCount: number;
  keys: ProviderKey[];
};

const CATEGORIES = ["text", "embedding", "image", "video", "tts"] as const;
const PRICE_UNITS = ["1M tokens", "1 ảnh", "1 giây", "1M ký tự"] as const;

const PROVIDER_TYPES = [
  { value: "OPENAI", label: "OpenAI", emoji: "🤖", example: "GPT-4o, GPT-4, GPT-3.5", needsBaseUrl: false },
  { value: "ANTHROPIC", label: "Claude (Anthropic)", emoji: "🧠", example: "Claude 3.5, Claude 3, Claude 2", needsBaseUrl: false },
  { value: "GEMINI", label: "Gemini (Google)", emoji: "💎", example: "Gemini Pro, Gemini Ultra", needsBaseUrl: false },
  { value: "OLLAMA", label: "Ollama", emoji: "🦙", example: "Self-hosted LLM", needsBaseUrl: true },
  { value: "OPENAI_COMPATIBLE", label: "OpenAI Compatible", emoji: "🔌", example: "Groq, Mistral, vLLM, LiteLLM, v.v.", needsBaseUrl: true },
];

const ROUTING_OPTIONS = [
  { value: "ROUND_ROBIN", label: "Round Robin", desc: "Xoay vòng đều giữa các key" },
  { value: "FAILOVER", label: "Failover", desc: "Luôn dùng key đầu, fail mới chuyển" },
  { value: "RANDOM", label: "Random", desc: "Chọn ngẫu nhiên" },
  { value: "LEAST_USED", label: "Least Used", desc: "Key ít dùng nhất" },
];

type ProviderForm = {
  name: string;
  description: string;
  type: string;
  baseUrl: string;
  routing: string;
  enabled: boolean;
  keys: string[];
};

const blankProvider: ProviderForm = {
  name: "",
  description: "",
  type: "OPENAI",
  baseUrl: "",
  routing: "ROUND_ROBIN",
  enabled: true,
  keys: [""],
};

type Editing = Partial<M> & {
  providerMode?: "existing" | "new"; // chọn sẵn hay tạo mới
  newProvider?: ProviderForm;
};

const blank: Editing = {
  slug: "", displayName: "", provider: "openai",
  category: "text", priceUnit: "1M tokens",
  inputPrice: 0, outputPrice: 0, contextLength: 128000,
  description: "", active: true,
  freeDiscount: 50, basicDiscount: 60, advDiscount: 70,
  speedTps: 0, latencyMs: 0, uptimeStatus: "good",
  providerId: null, upstreamSlug: "",
  providerMode: "existing",
};

const UPTIME_DOT: Record<string, string> = {
  good: "bg-emerald-400",
  warn: "bg-amber-400",
  down: "bg-rose-400",
};

export function ModelsAdminClient({ initial, providers = [] }: { initial: M[]; providers?: ProviderOpt[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [loading, setLoading] = useState(false);
  const [showProviderKeys, setShowProviderKeys] = useState(false);

  function startEdit(m: M) {
    setEditing({ ...m, providerMode: "existing" });
    setShowProviderKeys(false);
  }
  function startCreate() {
    setEditing({ ...blank });
    setShowProviderKeys(false);
  }

  async function save() {
    if (!editing) return;
    // Validate Model fields trước
    if (!editing.slug?.trim()) { alert("Thiếu Slug của model (vd: gpt-4o-mini)"); return; }
    if (!editing.displayName?.trim()) { alert("Thiếu Tên hiển thị của model"); return; }
    setLoading(true);
    // Build payload
    const payload: any = { ...editing };
    if (editing.providerMode === "new" && editing.newProvider) {
      const np = editing.newProvider;
      if (!np.name.trim()) { setLoading(false); alert("Provider thiếu tên"); return; }
      const typeMeta = PROVIDER_TYPES.find((t) => t.value === np.type);
      if (typeMeta?.needsBaseUrl && !np.baseUrl.trim()) {
        setLoading(false);
        alert(`Provider loại ${typeMeta.label} cần Base URL`);
        return;
      }
      const filtered = np.keys.map((k) => k.trim()).filter(Boolean);
      if (filtered.length === 0) { setLoading(false); alert("Provider cần ít nhất 1 API key"); return; }
      payload.newProvider = {
        name: np.name, description: np.description,
        type: np.type, baseUrl: np.baseUrl || null,
        routing: np.routing, enabled: np.enabled,
        keys: filtered,
      };
      payload.providerId = undefined; // server sẽ tạo + assign
    } else {
      payload.newProvider = undefined;
    }
    delete payload.providerMode;

    const isNew = !editing.id;
    const r = await fetch(`/api/admin/models${isNew ? "" : "/" + editing.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Lỗi"); return; }
    setEditing(null); router.refresh();
    const data = await r.json();
    if (isNew) setItems([...items, data]); else setItems(items.map((m) => m.id === data.id ? data : m));
  }

  async function del(id: string) {
    if (!confirm("Xóa model này?")) return;
    const r = await fetch(`/api/admin/models/${id}`, { method: "DELETE" });
    if (r.ok) { setItems(items.filter((m) => m.id !== id)); router.refresh(); }
  }

  async function delAll() {
    const c1 = prompt(`Sẽ xóa TẤT CẢ ${items.length} model. UsageLog cũ vẫn giữ.\n\nGõ "XOA TAT CA" để xác nhận:`);
    if (c1 !== "XOA TAT CA") return;
    if (!confirm(`Chắc chắn xóa ${items.length} model? Không thể khôi phục.`)) return;
    const r = await fetch("/api/admin/models?all=1", { method: "DELETE" });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Lỗi"); return; }
    const d = await r.json();
    setItems([]);
    router.refresh();
    alert(`Đã xóa ${d.deleted} model.`);
  }

  const selectedProvider = editing?.providerId ? providers.find((p) => p.id === editing.providerId) : null;
  const newProv = editing?.newProvider ?? blankProvider;
  const newProvTypeMeta = PROVIDER_TYPES.find((t) => t.value === newProv.type);

  return (
    <>
      <div className="flex justify-end gap-2">
        {items.length > 0 && (
          <button onClick={delAll} className="btn btn-danger">
            <Trash2 size={14} /> Xóa tất cả ({items.length})
          </button>
        )}
        <button onClick={startCreate} className="btn btn-primary"><Plus size={14} /> Thêm model</button>
      </div>

      {editing && (
        <div className="card p-5 border-honey-500/30 space-y-5">
          <div className="flex items-center justify-between">
            <p className="font-medium text-lg">{editing.id ? "Sửa model" : "Thêm model mới"}</p>
            <button onClick={() => setEditing(null)}><X size={16} /></button>
          </div>

          {/* THÔNG TIN MODEL */}
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-200/40 font-semibold mb-2">Thông tin model</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="label">Slug (unique)</label><input value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="input" placeholder="claude-sonnet-4.6" /></div>
              <div><label className="label">Tên hiển thị</label><input value={editing.displayName || ""} onChange={(e) => setEditing({ ...editing, displayName: e.target.value })} className="input" placeholder="Claude Sonnet 4.6" /></div>
              <div><label className="label">Provider (branding)</label>
                <select value={editing.provider || ""} onChange={(e) => setEditing({ ...editing, provider: e.target.value })} className="input">
                  {["openai", "anthropic", "google", "deepseek", "grok", "meta", "mistral", "other"].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <p className="text-[10px] text-ink-200/40 mt-1">Logo hiển thị ở user UI. Khác với Upstream Provider bên dưới.</p>
              </div>
              <div><label className="label">Loại model</label>
                <select value={editing.category || "text"} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="input">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">Đơn vị giá</label>
                <select value={editing.priceUnit || "1M tokens"} onChange={(e) => setEditing({ ...editing, priceUnit: e.target.value })} className="input">
                  {PRICE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div><label className="label">Context length</label><input type="number" value={editing.contextLength || 0} onChange={(e) => setEditing({ ...editing, contextLength: parseInt(e.target.value) || 0 })} className="input" /></div>
              <div><label className="label">Giá input ($/1M tokens)</label><input type="number" step="0.001" value={editing.inputPrice ? (editing.inputPrice / USD_VND_RATE) : 0} onChange={(e) => setEditing({ ...editing, inputPrice: Math.round((parseFloat(e.target.value) || 0) * USD_VND_RATE) })} className="input" /></div>
              <div><label className="label">Giá output ($/1M tokens)</label><input type="number" step="0.001" value={editing.outputPrice ? (editing.outputPrice / USD_VND_RATE) : 0} onChange={(e) => setEditing({ ...editing, outputPrice: Math.round((parseFloat(e.target.value) || 0) * USD_VND_RATE) })} className="input" /></div>
              <div><label className="label">Giảm Free (%)</label><input type="number" value={editing.freeDiscount ?? 0} onChange={(e) => setEditing({ ...editing, freeDiscount: parseFloat(e.target.value) || 0 })} className="input" /></div>
              <div><label className="label">Giảm Basic (%)</label><input type="number" value={editing.basicDiscount ?? 0} onChange={(e) => setEditing({ ...editing, basicDiscount: parseFloat(e.target.value) || 0 })} className="input" /></div>
              <div><label className="label">Giảm Adv+ (%)</label><input type="number" value={editing.advDiscount ?? 0} onChange={(e) => setEditing({ ...editing, advDiscount: parseFloat(e.target.value) || 0 })} className="input" /></div>
              <div><label className="label">Uptime</label>
                <select value={editing.uptimeStatus || "good"} onChange={(e) => setEditing({ ...editing, uptimeStatus: e.target.value })} className="input">
                  <option value="good">good</option><option value="warn">warn</option><option value="down">down</option>
                </select>
              </div>
              <div><label className="label">Tốc độ (tok/s)</label><input type="number" value={editing.speedTps ?? 0} onChange={(e) => setEditing({ ...editing, speedTps: parseFloat(e.target.value) || 0 })} className="input" /></div>
              <div><label className="label">Latency (ms)</label><input type="number" value={editing.latencyMs ?? 0} onChange={(e) => setEditing({ ...editing, latencyMs: parseFloat(e.target.value) || 0 })} className="input" /></div>
              <div className="md:col-span-2"><label className="label">Mô tả</label><textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="input resize-none" rows={2} /></div>
              <div className="md:col-span-2 flex items-center gap-2">
                <input id="active" type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                <label htmlFor="active" className="text-sm">Active</label>
              </div>
            </div>
          </div>

          {/* SECTION: UPSTREAM PROVIDER */}
          <div className="border-t border-white/5 pt-5">
            <p className="text-xs uppercase tracking-wider text-ink-200/40 font-semibold mb-2">Upstream Provider (nguồn key thật)</p>

            {/* Tabs */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setEditing({ ...editing, providerMode: "existing" })}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  editing.providerMode !== "new"
                    ? "bg-honey-400/15 text-honey-200 ring-1 ring-honey-400/30"
                    : "bg-white/[0.03] text-ink-200/60 hover:text-ink-200"
                }`}
              >
                Chọn provider sẵn có
              </button>
              <button
                type="button"
                onClick={() => setEditing({ ...editing, providerMode: "new", newProvider: { ...blankProvider } })}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  editing.providerMode === "new"
                    ? "bg-honey-400/15 text-honey-200 ring-1 ring-honey-400/30"
                    : "bg-white/[0.03] text-ink-200/60 hover:text-ink-200"
                }`}
              >
                <Plus size={12} className="inline -mt-0.5 mr-1" /> Tạo provider mới
              </button>
            </div>

            {editing.providerMode !== "new" ? (
              // === MODE: CHỌN SẴN ===
              <div className="space-y-3">
                <select
                  value={editing.providerId ?? ""}
                  onChange={(e) => setEditing({ ...editing, providerId: e.target.value || null })}
                  className="input"
                >
                  <option value="">— Env fallback (BEEKNOEE_BASE_URL) —</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.enabled}>
                      {p.enabled ? "" : "[OFF] "}{p.name} ({p.type}) — {p.keys.length} key{p.modelsCount > 0 ? ` • dùng ở ${p.modelsCount} model` : ""}
                    </option>
                  ))}
                </select>

                {/* Hiện key của provider được chọn */}
                {selectedProvider && (
                  <div className="rounded-lg border border-white/5 bg-black/20 p-3 space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowProviderKeys(!showProviderKeys)}
                      className="flex items-center gap-2 text-xs text-ink-200/70 hover:text-ink-200"
                    >
                      {showProviderKeys ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      Keys của <strong>{selectedProvider.name}</strong> ({selectedProvider.keys.length} key, routing: {selectedProvider.routing.replace("_", " ")})
                    </button>
                    {showProviderKeys && (
                      <div className="space-y-1.5">
                        {selectedProvider.keys.length === 0 && (
                          <p className="text-xs text-ink-200/40 italic">Provider này chưa có key.</p>
                        )}
                        {selectedProvider.keys.map((k) => (
                          <div key={k.id} className="flex items-center gap-2 text-xs font-mono bg-white/[0.02] rounded px-2 py-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${k.enabled ? "bg-emerald-400" : "bg-ink-700"}`} />
                            <span className="text-ink-200/50 w-20 shrink-0 truncate">{k.label || "—"}</span>
                            <span className="flex-1 truncate">{k.plainKey || "(decrypt fail)"}</span>
                            {k.plainKey && (
                              <button
                                type="button"
                                onClick={() => { navigator.clipboard.writeText(k.plainKey); alert("Đã copy"); }}
                                className="text-honey-300 hover:text-honey-200 shrink-0"
                              >
                                <Copy size={11} />
                              </button>
                            )}
                          </div>
                        ))}
                        <p className="text-[10px] text-ink-200/40 pt-1">
                          ⚠ Key plaintext — chỉ admin. Quản lý chi tiết ở <a href="/admin/providers" className="underline">/admin/providers</a>.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="label">Upstream Slug (tùy chọn)</label>
                  <input
                    value={editing.upstreamSlug ?? ""}
                    onChange={(e) => setEditing({ ...editing, upstreamSlug: e.target.value })}
                    className="input"
                    placeholder="Để trống = dùng Slug của model"
                  />
                  <p className="text-[10px] text-ink-200/40 mt-1">Tên model thật ở upstream (vd: <code>gpt-4o-mini</code>). Để gọi đúng API khi slug ở web khác với slug upstream.</p>
                </div>
              </div>
            ) : (
              // === MODE: TẠO MỚI ===
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Tên Provider <span className="text-rose-400">*</span></label>
                    <input
                      value={newProv.name}
                      onChange={(e) => setEditing({ ...editing, newProvider: { ...newProv, name: e.target.value } })}
                      className="input"
                      placeholder="VD: My OpenAI Provider"
                    />
                  </div>
                  <div>
                    <label className="label">Routing Strategy</label>
                    <select
                      value={newProv.routing}
                      onChange={(e) => setEditing({ ...editing, newProvider: { ...newProv, routing: e.target.value } })}
                      className="input"
                    >
                      {ROUTING_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Mô tả</label>
                  <textarea
                    value={newProv.description}
                    onChange={(e) => setEditing({ ...editing, newProvider: { ...newProv, description: e.target.value } })}
                    className="input resize-none"
                    rows={2}
                    placeholder="Mô tả ngắn về provider (tùy chọn)"
                  />
                </div>

                <div>
                  <label className="label">Loại Provider <span className="text-rose-400">*</span></label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {PROVIDER_TYPES.map((t) => {
                      const active = newProv.type === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setEditing({ ...editing, newProvider: { ...newProv, type: t.value } })}
                          className={`rounded-xl border p-3 text-left transition ${
                            active
                              ? "border-honey-400 bg-honey-400/10 ring-1 ring-honey-400/40"
                              : "border-white/10 bg-white/[0.02] hover:border-white/20"
                          }`}
                        >
                          <div className="text-xl mb-1">{t.emoji}</div>
                          <div className="text-xs font-medium">{t.label}</div>
                          <div className="text-[9px] text-ink-200/50 mt-0.5">{t.example}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="label">
                    Base URL {newProvTypeMeta?.needsBaseUrl && <span className="text-rose-400">*</span>}
                  </label>
                  <input
                    value={newProv.baseUrl}
                    onChange={(e) => setEditing({ ...editing, newProvider: { ...newProv, baseUrl: e.target.value } })}
                    className="input"
                    placeholder={
                      newProv.type === "OLLAMA"
                        ? "http://localhost:11434"
                        : newProvTypeMeta?.needsBaseUrl
                          ? "https://api.example.com/v1"
                          : "Để trống = endpoint mặc định"
                    }
                  />
                </div>

                <div>
                  <label className="label flex items-center justify-between">
                    <span>API Keys <span className="text-rose-400">*</span></span>
                    <span className="text-xs text-ink-200/50">{newProv.keys.filter((k) => k.trim()).length} key(s)</span>
                  </label>
                  <div className="space-y-2">
                    {newProv.keys.map((k, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-ink-200/40 w-4 text-right">{i + 1}</span>
                        <input
                          type="text"
                          value={k}
                          onChange={(e) => {
                            const next = [...newProv.keys]; next[i] = e.target.value;
                            setEditing({ ...editing, newProvider: { ...newProv, keys: next } });
                          }}
                          className="input flex-1 font-mono text-xs"
                          placeholder="sk-... (plaintext)"
                        />
                        {newProv.keys.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = newProv.keys.filter((_, idx) => idx !== i);
                              setEditing({ ...editing, newProvider: { ...newProv, keys: next } });
                            }}
                            className="btn btn-ghost text-rose-400"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, newProvider: { ...newProv, keys: [...newProv.keys, ""] } })}
                    className="mt-2 text-xs text-honey-300 hover:text-honey-200 flex items-center gap-1"
                  >
                    <Plus size={12} /> Thêm API Key
                  </button>
                </div>

                <div>
                  <label className="label">Upstream Slug (tùy chọn)</label>
                  <input
                    value={editing.upstreamSlug ?? ""}
                    onChange={(e) => setEditing({ ...editing, upstreamSlug: e.target.value })}
                    className="input"
                    placeholder="Để trống = dùng Slug của model"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-3 border-t border-white/5">
            <button
              disabled={loading}
              onClick={save}
              className="btn btn-primary bg-gradient-to-r from-blue-500 to-purple-500 border-none text-white"
            >
              {loading && <Loader2 size={14} className="animate-spin" />} Lưu model
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-ghost">Hủy</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Model</th>
              <th className="table-th">Provider</th>
              <th className="table-th">Upstream</th>
              <th className="table-th text-right">Input</th>
              <th className="table-th text-right">Output</th>
              <th className="table-th text-right">Context</th>
              <th className="table-th text-center">Tier (F/B/A+)</th>
              <th className="table-th text-center">Uptime</th>
              <th className="table-th">Active</th>
              <th className="table-th text-right"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => {
              const up = m.providerId ? providers.find((p) => p.id === m.providerId) : null;
              return (
                <tr key={m.id}>
                  <td className="table-td"><p className="font-medium">{m.displayName}</p><p className="text-xs text-ink-200/50 font-mono">{m.slug}</p></td>
                  <td className="table-td"><span className="badge bg-white/5">{m.provider}</span></td>
                  <td className="table-td">
                    {up ? (
                      <div>
                        <p className="text-xs font-medium">{up.name}</p>
                        <p className="text-[10px] text-ink-200/40">{up.type} · {up.keys.length} key</p>
                      </div>
                    ) : (
                      <span className="text-[10px] text-ink-200/40">env fallback</span>
                    )}
                  </td>
                  <td className="table-td text-right text-honey-300">{formatUSD(m.inputPrice)}</td>
                  <td className="table-td text-right text-honey-300">{formatUSD(m.outputPrice)}</td>
                  <td className="table-td text-right">{m.contextLength.toLocaleString()}</td>
                  <td className="table-td text-center text-xs text-ink-200/70">{m.freeDiscount}/{m.basicDiscount}/{m.advDiscount}%</td>
                  <td className="table-td text-center"><span className={`inline-block w-2 h-2 rounded-full ${UPTIME_DOT[m.uptimeStatus] ?? "bg-white/30"}`} title={m.uptimeStatus} /></td>
                  <td className="table-td"><span className={`badge ${m.active ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-700/40 text-ink-200/50"}`}>{m.active ? "ON" : "OFF"}</span></td>
                  <td className="table-td text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => startEdit(m)} className="btn btn-ghost text-xs"><Edit size={12} /></button>
                      <button onClick={() => del(m.id)} className="btn btn-danger text-xs"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
