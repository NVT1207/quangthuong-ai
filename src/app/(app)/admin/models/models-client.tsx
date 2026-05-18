"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2, X, Loader2, Copy, Eye, EyeOff } from "lucide-react";
import { formatUSD, USD_VND_RATE } from "@/lib/format";
import {
  IMAGE_SIZES,
  IMAGE_QUALITIES,
  VIDEO_RESOLUTIONS,
  VIDEO_DURATIONS,
  OPENAI_TTS_VOICES,
  WHISPER_LANGUAGES,
  type Modality,
  type ImageMatrixRow,
  type VideoMatrixRow,
  type TtsVoice,
} from "@/lib/pricing";

type M = {
  id: string; slug: string; displayName: string; provider: string;
  category: string; priceUnit: string;
  inputPrice: number; outputPrice: number; contextLength: number;
  description: string | null; active: boolean; createdAt: string;
  freeDiscount: number; basicDiscount: number; advDiscount: number;
  speedTps: number; latencyMs: number; uptimeStatus: string;
  apiType: string;
  apiBaseUrl: string | null;
  apiBaseUrlImages: string | null;
  apiKey: string; // plaintext from server
  apiKeyPrefix: string | null;
  upstreamSlug: string | null;
  totalRequests: number;
  totalErrors: number;
  lastUsedAt: string | null;
  // Multi-modality
  modality: string;
  pricingData: any | null;
};

const CATEGORIES = ["text", "embedding", "image", "video", "tts", "stt"] as const;
const PRICE_UNITS = ["1M tokens", "1 ảnh", "1 video", "1M ký tự", "1 phút audio"] as const;

const MODALITIES: { value: Modality; label: string; icon: string }[] = [
  { value: "TEXT",       label: "TEXT (chat/completions)", icon: "💬" },
  { value: "EMBEDDING",  label: "EMBEDDING (vector)",      icon: "📐" },
  { value: "IMAGE",      label: "IMAGE (size × quality)",  icon: "🖼️" },
  { value: "VIDEO",      label: "VIDEO (res × duration)",  icon: "🎬" },
  { value: "AUDIO_TTS",  label: "AUDIO TTS (per-char)",    icon: "🔊" },
  { value: "AUDIO_STT",  label: "AUDIO STT (per-minute)",  icon: "🎤" },
];

const API_TYPES = [
  { value: "OPENAI", label: "OpenAI", emoji: "🤖", example: "GPT-4o, GPT-4, GPT-3.5", needsBaseUrl: false, defaultBase: "https://api.openai.com/v1" },
  { value: "ANTHROPIC", label: "Claude (Anthropic)", emoji: "🧠", example: "Claude 3.5, 3, 2", needsBaseUrl: false, defaultBase: "https://api.anthropic.com/v1" },
  { value: "GEMINI", label: "Gemini (Google)", emoji: "💎", example: "Gemini Pro, Ultra", needsBaseUrl: false, defaultBase: "https://generativelanguage.googleapis.com/v1beta" },
  { value: "OLLAMA", label: "Ollama", emoji: "🦙", example: "Self-hosted LLM", needsBaseUrl: true, defaultBase: "" },
  { value: "OPENAI_COMPATIBLE", label: "OpenAI Compatible", emoji: "🔌", example: "Groq, Mistral, vLLM…", needsBaseUrl: true, defaultBase: "" },
];

type Editing = Partial<M> & { apiKeyChanged?: boolean };

const blank: Editing = {
  slug: "", displayName: "", provider: "openai",
  category: "text", priceUnit: "1M tokens",
  inputPrice: 0, outputPrice: 0, contextLength: 128000,
  description: "", active: true,
  freeDiscount: 50, basicDiscount: 60, advDiscount: 70,
  speedTps: 0, latencyMs: 0, uptimeStatus: "good",
  apiType: "OPENAI", apiBaseUrl: "", apiBaseUrlImages: "", apiKey: "", upstreamSlug: "",
  modality: "TEXT", pricingData: null,
};

const UPTIME_DOT: Record<string, string> = {
  good: "bg-emerald-400",
  warn: "bg-amber-400",
  down: "bg-rose-400",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function ModelsAdminClient({ initial }: { initial: M[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  function startEdit(m: M) {
    setEditing({ ...m, apiKey: m.apiKey || "", apiKeyChanged: false });
    setShowKey(false);
  }
  function startCreate() {
    setEditing({ ...blank, apiKeyChanged: true });
    setShowKey(true);
  }

  async function save() {
    if (!editing) return;
    if (!editing.displayName?.trim()) { alert("Thiếu Tên hiển thị"); return; }
    let finalSlug = editing.slug?.trim();
    if (!finalSlug) {
      finalSlug = slugify(editing.displayName);
      if (!finalSlug) { alert("Tên hiển thị không hợp lệ để tạo slug"); return; }
    }

    const typeMeta = API_TYPES.find((t) => t.value === editing.apiType);
    if (typeMeta?.needsBaseUrl && !editing.apiBaseUrl?.trim()) {
      alert(`Loại API ${typeMeta.label} cần Base URL`);
      return;
    }

    setLoading(true);
    const isNew = !editing.id;
    const payload: any = {
      ...editing,
      slug: finalSlug,
      apiBaseUrl: editing.apiBaseUrl?.trim() || null,
      apiBaseUrlImages: editing.apiBaseUrlImages?.trim() || null,
    };
    // Chỉ gửi apiKey nếu admin đã thay đổi (hoặc tạo mới)
    if (!editing.apiKeyChanged) delete payload.apiKey;
    delete payload.apiKeyChanged;

    const r = await fetch(`/api/admin/models${isNew ? "" : "/" + editing.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Lỗi"); return; }
    setEditing(null); router.refresh();
    const data = await r.json();
    const enriched = { ...data, apiKey: editing.apiKey || data.apiKey || "" };
    if (isNew) setItems([...items, enriched]); else setItems(items.map((m) => m.id === data.id ? enriched : m));
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

  const typeMeta = API_TYPES.find((t) => t.value === (editing?.apiType || "OPENAI"));

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
              <div>
                <label className="label">Tên hiển thị <span className="text-rose-400">*</span></label>
                <input value={editing.displayName || ""} onChange={(e) => setEditing({ ...editing, displayName: e.target.value })} className="input" placeholder="GPT-4o Mini" />
              </div>
              <div>
                <label className="label">Slug <span className="text-ink-200/40 text-[10px]">(tự tạo từ Tên nếu bỏ trống)</span></label>
                <input value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="input font-mono text-xs" placeholder={editing.displayName ? slugify(editing.displayName) : "vd: gpt-4o-mini"} />
              </div>
              <div><label className="label">Provider (branding logo)</label>
                <select value={editing.provider || ""} onChange={(e) => setEditing({ ...editing, provider: e.target.value })} className="input">
                  {["openai", "anthropic", "google", "deepseek", "grok", "meta", "mistral", "other"].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div><label className="label">Loại model</label>
                <select value={editing.category || "text"} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="input">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Modality (cách tính giá) <span className="text-rose-400">*</span></label>
                <select
                  value={editing.modality || "TEXT"}
                  onChange={(e) => {
                    const m = e.target.value as Modality;
                    // Reset pricingData về shape mặc định khi đổi modality
                    let nextPricingData: any = null;
                    if (m === "IMAGE") nextPricingData = { matrix: [] };
                    else if (m === "VIDEO") nextPricingData = { matrix: [] };
                    else if (m === "AUDIO_TTS") nextPricingData = { charRate: 0, voices: [] };
                    else if (m === "AUDIO_STT") nextPricingData = { minuteRate: 0, languages: [] };
                    setEditing({ ...editing, modality: m, pricingData: nextPricingData });
                  }}
                  className="input"
                >
                  {MODALITIES.map((m) => <option key={m.value} value={m.value}>{m.icon} {m.label}</option>)}
                </select>
                <p className="text-[10px] text-ink-200/40 mt-1">
                  TEXT/EMBEDDING dùng input/output price (1M tokens). IMAGE/VIDEO dùng matrix. AUDIO_TTS theo char, AUDIO_STT theo phút.
                </p>
              </div>
              <div><label className="label">Đơn vị giá</label>
                <select value={editing.priceUnit || "1M tokens"} onChange={(e) => setEditing({ ...editing, priceUnit: e.target.value })} className="input">
                  {PRICE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div><label className="label">Context length</label><input type="number" value={editing.contextLength || 0} onChange={(e) => setEditing({ ...editing, contextLength: parseInt(e.target.value) || 0 })} className="input" /></div>
              {(editing.modality === "TEXT" || editing.modality === "EMBEDDING" || !editing.modality) && (
                <>
                  <div><label className="label">Giá input ($/1M tokens)</label><input type="number" step="0.001" value={editing.inputPrice ? (editing.inputPrice / USD_VND_RATE) : 0} onChange={(e) => setEditing({ ...editing, inputPrice: Math.round((parseFloat(e.target.value) || 0) * USD_VND_RATE) })} className="input" /></div>
                  <div><label className="label">Giá output ($/1M tokens)</label><input type="number" step="0.001" value={editing.outputPrice ? (editing.outputPrice / USD_VND_RATE) : 0} onChange={(e) => setEditing({ ...editing, outputPrice: Math.round((parseFloat(e.target.value) || 0) * USD_VND_RATE) })} className="input" /></div>
                </>
              )}
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

          {/* PRICING THEO MODALITY */}
          {editing.modality === "IMAGE" && (
            <div className="border-t border-white/5 pt-5">
              <p className="text-xs uppercase tracking-wider text-ink-200/40 font-semibold mb-3">Bảng giá IMAGE (size × quality)</p>
              <ImagePricingMatrix
                rows={(editing.pricingData?.matrix as ImageMatrixRow[]) ?? []}
                onChange={(rows) => setEditing({ ...editing, pricingData: { ...(editing.pricingData ?? {}), matrix: rows } })}
              />
            </div>
          )}
          {editing.modality === "VIDEO" && (
            <div className="border-t border-white/5 pt-5">
              <p className="text-xs uppercase tracking-wider text-ink-200/40 font-semibold mb-3">Bảng giá VIDEO (resolution × duration)</p>
              <VideoPricingMatrix
                rows={(editing.pricingData?.matrix as VideoMatrixRow[]) ?? []}
                onChange={(rows) => setEditing({ ...editing, pricingData: { ...(editing.pricingData ?? {}), matrix: rows } })}
              />
            </div>
          )}
          {editing.modality === "AUDIO_TTS" && (
            <div className="border-t border-white/5 pt-5">
              <p className="text-xs uppercase tracking-wider text-ink-200/40 font-semibold mb-3">Bảng giá AUDIO TTS (per-char + voices)</p>
              <TtsEditor
                charRateVND={(editing.pricingData?.charRate as number) ?? 0}
                voices={(editing.pricingData?.voices as TtsVoice[]) ?? []}
                onChange={(charRate, voices) => setEditing({ ...editing, pricingData: { charRate, voices } })}
              />
            </div>
          )}
          {editing.modality === "AUDIO_STT" && (
            <div className="border-t border-white/5 pt-5">
              <p className="text-xs uppercase tracking-wider text-ink-200/40 font-semibold mb-3">Bảng giá AUDIO STT (per-phút)</p>
              <SttEditor
                minuteRateVND={(editing.pricingData?.minuteRate as number) ?? 0}
                languages={(editing.pricingData?.languages as string[]) ?? []}
                onChange={(minuteRate, languages) => setEditing({ ...editing, pricingData: { minuteRate, languages } })}
              />
            </div>
          )}

          {/* SECTION: API CONFIG */}
          <div className="border-t border-white/5 pt-5">
            <p className="text-xs uppercase tracking-wider text-ink-200/40 font-semibold mb-3">API Upstream (key gọi tới nhà cung cấp)</p>

            <div className="space-y-4">
              <div>
                <label className="label">Loại API <span className="text-rose-400">*</span></label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {API_TYPES.map((t) => {
                    const active = (editing.apiType || "OPENAI") === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setEditing({ ...editing, apiType: t.value, apiBaseUrl: editing.apiBaseUrl || t.defaultBase })}
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
                  Base URL {typeMeta?.needsBaseUrl && <span className="text-rose-400">*</span>}
                  <span className="text-ink-200/40 text-[10px] ml-2">{!typeMeta?.needsBaseUrl ? "(để trống = endpoint mặc định)" : ""}</span>
                </label>
                <input
                  value={editing.apiBaseUrl ?? ""}
                  onChange={(e) => setEditing({ ...editing, apiBaseUrl: e.target.value })}
                  className="input font-mono text-xs"
                  placeholder={
                    editing.apiType === "OLLAMA"
                      ? "http://localhost:11434"
                      : typeMeta?.needsBaseUrl
                        ? "https://api.example.com/v1"
                        : typeMeta?.defaultBase || "https://api.example.com/v1"
                  }
                />
              </div>

              {editing.modality === "IMAGE" && (
                <div>
                  <label className="label">
                    Base URL — Image
                    <span className="text-ink-200/40 text-[10px] ml-2">(để trống = dùng Base URL chính)</span>
                  </label>
                  <input
                    value={editing.apiBaseUrlImages ?? ""}
                    onChange={(e) => setEditing({ ...editing, apiBaseUrlImages: e.target.value })}
                    className="input font-mono text-xs"
                    placeholder="https://llm-2.chiasegpu.vn/v1"
                  />
                  <p className="text-[10px] text-ink-200/50 mt-1">
                    ChiaSeGPU tách host cho image endpoint. Set <code>llm-2.chiasegpu.vn/v1</code> nếu gateway của em yêu cầu host riêng cho /images/generations.
                  </p>
                </div>
              )}

              <div>
                <label className="label flex items-center justify-between">
                  <span>API Key {!editing.id && <span className="text-rose-400">*</span>}</span>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-xs text-ink-200/60 hover:text-ink-200 flex items-center gap-1"
                  >
                    {showKey ? <EyeOff size={11} /> : <Eye size={11} />}
                    {showKey ? "Ẩn" : "Hiện"}
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={editing.apiKey ?? ""}
                    onChange={(e) => setEditing({ ...editing, apiKey: e.target.value, apiKeyChanged: true })}
                    className="input font-mono text-xs pr-10"
                    placeholder={editing.id ? "Để trống = giữ key hiện tại" : "sk-..."}
                  />
                  {editing.apiKey && (
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(editing.apiKey || ""); alert("Đã copy"); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-honey-300 hover:text-honey-200"
                    >
                      <Copy size={12} />
                    </button>
                  )}
                </div>
                {editing.id && editing.apiKeyPrefix && (
                  <p className="text-[10px] text-ink-200/40 mt-1">
                    Key hiện tại: <code className="bg-white/5 px-1">{editing.apiKeyPrefix}…</code>
                  </p>
                )}
              </div>

              <div>
                <label className="label">Upstream Slug <span className="text-ink-200/40 text-[10px]">(tên model thật ở upstream — tùy chọn)</span></label>
                <input
                  value={editing.upstreamSlug ?? ""}
                  onChange={(e) => setEditing({ ...editing, upstreamSlug: e.target.value })}
                  className="input font-mono text-xs"
                  placeholder="Để trống = dùng Slug của model"
                />
                <p className="text-[10px] text-ink-200/40 mt-1">VD: web hiện model là <code>gpt-4o</code> nhưng upstream nhận <code>gpt-4o-2024-11-20</code>.</p>
              </div>
            </div>
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
              <th className="table-th">Modality</th>
              <th className="table-th">API Type</th>
              <th className="table-th">Key</th>
              <th className="table-th text-right">Input</th>
              <th className="table-th text-right">Output</th>
              <th className="table-th text-right">Context</th>
              <th className="table-th text-center">Active</th>
              <th className="table-th text-right"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id}>
                <td className="table-td"><p className="font-medium">{m.displayName}</p><p className="text-xs text-ink-200/50 font-mono">{m.slug}</p></td>
                <td className="table-td"><span className="badge bg-white/5">{m.provider}</span></td>
                <td className="table-td"><span className="badge bg-white/5 text-[10px]">{m.modality || "TEXT"}</span></td>
                <td className="table-td text-xs">{m.apiType?.replace("OPENAI_COMPATIBLE", "Compat") || "—"}</td>
                <td className="table-td">
                  {m.apiKeyPrefix ? (
                    <code className="text-[10px] text-honey-300 bg-white/5 px-1.5 py-0.5 rounded">{m.apiKeyPrefix}…</code>
                  ) : (
                    <span className="text-[10px] text-ink-200/40">env fallback</span>
                  )}
                </td>
                <td className="table-td text-right text-honey-300">{m.modality === "TEXT" || m.modality === "EMBEDDING" || !m.modality ? formatUSD(m.inputPrice) : <span className="text-ink-200/40 text-xs">matrix</span>}</td>
                <td className="table-td text-right text-honey-300">{m.modality === "TEXT" || m.modality === "EMBEDDING" || !m.modality ? formatUSD(m.outputPrice) : <span className="text-ink-200/40 text-xs">—</span>}</td>
                <td className="table-td text-right">{m.contextLength.toLocaleString()}</td>
                <td className="table-td text-center"><span className={`inline-block w-2 h-2 rounded-full ${UPTIME_DOT[m.uptimeStatus] ?? "bg-white/30"}`} title={m.uptimeStatus} /></td>
                <td className="table-td text-right">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => startEdit(m)} className="btn btn-ghost text-xs"><Edit size={12} /></button>
                    <button onClick={() => del(m.id)} className="btn btn-danger text-xs"><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ====================================================================
// Sub-components: pricing editors theo modality
// ====================================================================

function ImagePricingMatrix({
  rows,
  onChange,
}: {
  rows: ImageMatrixRow[];
  onChange: (rows: ImageMatrixRow[]) => void;
}) {
  function addRow() {
    onChange([...rows, { size: "1024x1024", quality: "auto", price: 0 }]);
  }
  function updateRow(i: number, patch: Partial<ImageMatrixRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function delRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  function bulkFillOpenAI() {
    // Demo prices gpt-image-1: low/medium/high cho 3 size phổ biến
    const presets: ImageMatrixRow[] = [
      { size: "1024x1024", quality: "low",    price: Math.round(0.011 * USD_VND_RATE) },
      { size: "1024x1024", quality: "medium", price: Math.round(0.042 * USD_VND_RATE) },
      { size: "1024x1024", quality: "high",   price: Math.round(0.167 * USD_VND_RATE) },
      { size: "1024x1536", quality: "low",    price: Math.round(0.016 * USD_VND_RATE) },
      { size: "1024x1536", quality: "medium", price: Math.round(0.063 * USD_VND_RATE) },
      { size: "1024x1536", quality: "high",   price: Math.round(0.250 * USD_VND_RATE) },
      { size: "1536x1024", quality: "low",    price: Math.round(0.016 * USD_VND_RATE) },
      { size: "1536x1024", quality: "medium", price: Math.round(0.063 * USD_VND_RATE) },
      { size: "1536x1024", quality: "high",   price: Math.round(0.250 * USD_VND_RATE) },
    ];
    onChange(presets);
  }
  // Phát hiện duplicate (size, quality)
  const dupKeys = new Set<string>();
  const dups = new Set<number>();
  rows.forEach((r, i) => {
    const k = `${r.size}::${r.quality}`;
    if (dupKeys.has(k)) dups.add(i);
    dupKeys.add(k);
  });
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] text-ink-200/50">
        <span>{rows.length} dòng giá</span>
        <button type="button" onClick={bulkFillOpenAI} className="ml-auto btn btn-ghost text-[10px] px-2 py-1">⚡ Bulk fill gpt-image-1</button>
        <button type="button" onClick={addRow} className="btn btn-primary text-[10px] px-2 py-1"><Plus size={10} /> Thêm dòng</button>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-ink-200/40 italic py-3 text-center border border-dashed border-white/10 rounded-lg">
          Chưa có dòng giá nào. Bấm "Thêm dòng" hoặc "Bulk fill".
        </p>
      )}
      {rows.map((r, i) => (
        <div key={i} className={`grid grid-cols-12 gap-2 items-center ${dups.has(i) ? "ring-1 ring-rose-500/40 rounded-lg p-1" : ""}`}>
          <select value={r.size} onChange={(e) => updateRow(i, { size: e.target.value })} className="input col-span-4 text-xs">
            {IMAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={r.quality} onChange={(e) => updateRow(i, { quality: e.target.value })} className="input col-span-3 text-xs">
            {IMAGE_QUALITIES.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
          <div className="col-span-4 relative">
            <input
              type="number" step="0.001"
              value={r.price ? r.price / USD_VND_RATE : 0}
              onChange={(e) => updateRow(i, { price: Math.round((parseFloat(e.target.value) || 0) * USD_VND_RATE) })}
              className="input text-xs pr-12"
              placeholder="$ / ảnh"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-200/40">$/ảnh</span>
          </div>
          <button type="button" onClick={() => delRow(i)} className="col-span-1 text-rose-400 hover:text-rose-300"><X size={14} /></button>
        </div>
      ))}
      {dups.size > 0 && (
        <p className="text-xs text-rose-400">⚠️ Có {dups.size} dòng trùng (size, quality) — chỉ dòng đầu được dùng.</p>
      )}
    </div>
  );
}

function VideoPricingMatrix({
  rows,
  onChange,
}: {
  rows: VideoMatrixRow[];
  onChange: (rows: VideoMatrixRow[]) => void;
}) {
  function addRow() {
    onChange([...rows, { resolution: "720p", duration: "8s", price: 0 }]);
  }
  function updateRow(i: number, patch: Partial<VideoMatrixRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function delRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  function bulkFillSora() {
    const presets: VideoMatrixRow[] = [
      { resolution: "720p",  duration: "6s",  price: Math.round(0.30 * USD_VND_RATE) },
      { resolution: "720p",  duration: "10s", price: Math.round(0.50 * USD_VND_RATE) },
      { resolution: "1080p", duration: "6s",  price: Math.round(0.60 * USD_VND_RATE) },
      { resolution: "1080p", duration: "10s", price: Math.round(1.00 * USD_VND_RATE) },
      { resolution: "1080p", duration: "15s", price: Math.round(1.50 * USD_VND_RATE) },
      { resolution: "4k",    duration: "10s", price: Math.round(2.00 * USD_VND_RATE) },
    ];
    onChange(presets);
  }
  const dupKeys = new Set<string>();
  const dups = new Set<number>();
  rows.forEach((r, i) => {
    const k = `${r.resolution}::${r.duration}`;
    if (dupKeys.has(k)) dups.add(i);
    dupKeys.add(k);
  });
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] text-ink-200/50">
        <span>{rows.length} dòng giá</span>
        <button type="button" onClick={bulkFillSora} className="ml-auto btn btn-ghost text-[10px] px-2 py-1">⚡ Bulk fill Sora</button>
        <button type="button" onClick={addRow} className="btn btn-primary text-[10px] px-2 py-1"><Plus size={10} /> Thêm dòng</button>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-ink-200/40 italic py-3 text-center border border-dashed border-white/10 rounded-lg">
          Chưa có dòng giá. Bấm "Thêm dòng" hoặc "Bulk fill".
        </p>
      )}
      {rows.map((r, i) => (
        <div key={i} className={`grid grid-cols-12 gap-2 items-center ${dups.has(i) ? "ring-1 ring-rose-500/40 rounded-lg p-1" : ""}`}>
          <select value={r.resolution} onChange={(e) => updateRow(i, { resolution: e.target.value })} className="input col-span-4 text-xs">
            {VIDEO_RESOLUTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={r.duration} onChange={(e) => updateRow(i, { duration: e.target.value })} className="input col-span-3 text-xs">
            {VIDEO_DURATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
          <div className="col-span-4 relative">
            <input
              type="number" step="0.001"
              value={r.price ? r.price / USD_VND_RATE : 0}
              onChange={(e) => updateRow(i, { price: Math.round((parseFloat(e.target.value) || 0) * USD_VND_RATE) })}
              className="input text-xs pr-14"
              placeholder="$ / video"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-200/40">$/video</span>
          </div>
          <button type="button" onClick={() => delRow(i)} className="col-span-1 text-rose-400 hover:text-rose-300"><X size={14} /></button>
        </div>
      ))}
      {dups.size > 0 && (
        <p className="text-xs text-rose-400">⚠️ Có {dups.size} dòng trùng (resolution, duration).</p>
      )}
    </div>
  );
}

function TtsEditor({
  charRateVND,
  voices,
  onChange,
}: {
  charRateVND: number;
  voices: TtsVoice[];
  onChange: (charRateVND: number, voices: TtsVoice[]) => void;
}) {
  function addVoice() {
    onChange(charRateVND, [...voices, { id: "", name: "" }]);
  }
  function updateVoice(i: number, patch: Partial<TtsVoice>) {
    onChange(charRateVND, voices.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function delVoice(i: number) {
    onChange(charRateVND, voices.filter((_, idx) => idx !== i));
  }
  function fillOpenAIVoices() {
    onChange(charRateVND, OPENAI_TTS_VOICES);
  }
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="label">Char rate ($/1M chars)</label>
          <input
            type="number" step="0.01"
            value={charRateVND ? charRateVND / USD_VND_RATE : 0}
            onChange={(e) => onChange(Math.round((parseFloat(e.target.value) || 0) * USD_VND_RATE), voices)}
            className="input"
            placeholder="vd 30 (= $30 / 1M chars)"
          />
          <p className="text-[10px] text-ink-200/40 mt-1">OpenAI tts-1 = $15/1M, tts-1-hd = $30/1M.</p>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs text-ink-200/60">Voices ({voices.length})</p>
          <button type="button" onClick={fillOpenAIVoices} className="ml-auto btn btn-ghost text-[10px] px-2 py-1">⚡ Fill OpenAI 6 voices</button>
          <button type="button" onClick={addVoice} className="btn btn-primary text-[10px] px-2 py-1"><Plus size={10} /> Thêm voice</button>
        </div>
        {voices.length === 0 && (
          <p className="text-xs text-ink-200/40 italic py-3 text-center border border-dashed border-white/10 rounded-lg">
            Chưa có voice nào.
          </p>
        )}
        {voices.map((v, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center mb-2">
            <input value={v.id} onChange={(e) => updateVoice(i, { id: e.target.value })} className="input col-span-3 text-xs font-mono" placeholder="alloy" />
            <input value={v.name} onChange={(e) => updateVoice(i, { name: e.target.value })} className="input col-span-4 text-xs" placeholder="Alloy" />
            <select value={v.gender ?? ""} onChange={(e) => updateVoice(i, { gender: e.target.value || undefined })} className="input col-span-4 text-xs">
              <option value="">— gender —</option>
              <option value="male">Male</option><option value="female">Female</option><option value="neutral">Neutral</option>
            </select>
            <button type="button" onClick={() => delVoice(i)} className="col-span-1 text-rose-400 hover:text-rose-300"><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SttEditor({
  minuteRateVND,
  languages,
  onChange,
}: {
  minuteRateVND: number;
  languages: string[];
  onChange: (minuteRateVND: number, languages: string[]) => void;
}) {
  const langCsv = languages.join(", ");
  function fillWhisper() {
    onChange(minuteRateVND, [...WHISPER_LANGUAGES]);
  }
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="label">Minute rate ($/phút audio)</label>
          <input
            type="number" step="0.001"
            value={minuteRateVND ? minuteRateVND / USD_VND_RATE : 0}
            onChange={(e) => onChange(Math.round((parseFloat(e.target.value) || 0) * USD_VND_RATE), languages)}
            className="input"
            placeholder="vd 0.006 (= $0.006 / phút)"
          />
          <p className="text-[10px] text-ink-200/40 mt-1">Whisper-1 = $0.006 / phút.</p>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs text-ink-200/60">Ngôn ngữ hỗ trợ ({languages.length})</p>
          <button type="button" onClick={fillWhisper} className="ml-auto btn btn-ghost text-[10px] px-2 py-1">⚡ Fill 99 langs Whisper</button>
        </div>
        <textarea
          value={langCsv}
          onChange={(e) => {
            const arr = e.target.value
              .split(/[,\s]+/)
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean);
            onChange(minuteRateVND, Array.from(new Set(arr)));
          }}
          className="input resize-none text-xs font-mono"
          rows={4}
          placeholder="vi, en, ja, ko, fr, de, ..."
        />
        <p className="text-[10px] text-ink-200/40 mt-1">ISO 639-1 codes, phân tách bằng dấu phẩy hoặc khoảng trắng.</p>
      </div>
    </div>
  );
}
