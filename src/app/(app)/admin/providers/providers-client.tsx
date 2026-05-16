"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Edit, Trash2, X, Loader2, Eye, EyeOff, Network,
  CheckCircle2, AlertTriangle, RefreshCw, Key as KeyIcon, ChevronDown, ChevronRight,
} from "lucide-react";

type ProviderKey = {
  id: string;
  prefix: string;
  label: string | null;
  enabled: boolean;
  lastUsedAt: string | null;
  lastErrorAt: string | null;
  errorCount: number;
  totalRequests: number;
  totalErrors: number;
  createdAt: string;
};

type Provider = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  baseUrl: string | null;
  enabled: boolean;
  routing: string;
  rrCursor: number;
  createdAt: string;
  keys: ProviderKey[];
  modelsCount: number;
};

const PROVIDER_TYPES = [
  { value: "OPENAI", label: "OpenAI", emoji: "🤖", example: "GPT-4, GPT-3.5", needsBaseUrl: false },
  { value: "ANTHROPIC", label: "Claude (Anthropic)", emoji: "🧠", example: "Claude 3.5, Claude 3", needsBaseUrl: false },
  { value: "GEMINI", label: "Gemini (Google)", emoji: "💎", example: "Gemini 2.0, 1.5 Pro", needsBaseUrl: false },
  { value: "OLLAMA", label: "Ollama", emoji: "🦙", example: "Local: llama3, mistral", needsBaseUrl: true },
  { value: "OPENAI_COMPATIBLE", label: "OpenAI Compatible", emoji: "🔌", example: "DeepSeek, Groq, vLLM…", needsBaseUrl: true },
];

const ROUTING_OPTIONS = [
  { value: "ROUND_ROBIN", label: "Round Robin", desc: "Xoay vòng đều giữa các key" },
  { value: "FAILOVER", label: "Failover", desc: "Luôn dùng key đầu, fail mới chuyển" },
  { value: "RANDOM", label: "Random", desc: "Chọn ngẫu nhiên" },
  { value: "LEAST_USED", label: "Least Used", desc: "Key ít dùng nhất" },
];

type Editing = {
  id?: string;
  name: string;
  description: string;
  type: string;
  baseUrl: string;
  routing: string;
  enabled: boolean;
  keys: string[]; // raw plaintext keys (chỉ khi tạo mới)
};

const blank: Editing = {
  name: "",
  description: "",
  type: "OPENAI",
  baseUrl: "",
  routing: "ROUND_ROBIN",
  enabled: true,
  keys: [""],
};

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

export function ProvidersClient({ initial }: { initial: Provider[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Provider[]>(initial);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState<Record<number, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addingKeyTo, setAddingKeyTo] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);

  function startCreate() {
    setEditing({ ...blank });
    setShowKey({});
  }
  function startEdit(p: Provider) {
    setEditing({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      type: p.type,
      baseUrl: p.baseUrl ?? "",
      routing: p.routing,
      enabled: p.enabled,
      keys: [], // không edit key tại đây
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) { alert("Thiếu tên provider"); return; }
    const typeMeta = PROVIDER_TYPES.find((t) => t.value === editing.type);
    if (typeMeta?.needsBaseUrl && !editing.baseUrl.trim()) {
      alert(`Provider loại ${typeMeta.label} cần Base URL`);
      return;
    }
    const isNew = !editing.id;
    if (isNew) {
      const filtered = editing.keys.map((k) => k.trim()).filter(Boolean);
      if (filtered.length === 0) { alert("Cần ít nhất 1 API key"); return; }
      setLoading(true);
      const r = await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name,
          description: editing.description,
          type: editing.type,
          baseUrl: editing.baseUrl || null,
          routing: editing.routing,
          enabled: editing.enabled,
          keys: filtered,
        }),
      });
      setLoading(false);
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Lỗi tạo"); return; }
      const created = await r.json();
      setItems([{ ...created, modelsCount: created._count?.models ?? 0, createdAt: created.createdAt }, ...items]);
      setEditing(null);
      router.refresh();
    } else {
      setLoading(true);
      const r = await fetch(`/api/admin/providers/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name,
          description: editing.description,
          type: editing.type,
          baseUrl: editing.baseUrl || null,
          routing: editing.routing,
          enabled: editing.enabled,
        }),
      });
      setLoading(false);
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Lỗi cập nhật"); return; }
      const updated = await r.json();
      setItems(items.map((p) => p.id === updated.id ? { ...p, ...updated } : p));
      setEditing(null);
      router.refresh();
    }
  }

  async function delProvider(id: string) {
    if (!confirm("Xóa provider? Các model gắn nó sẽ chuyển về env fallback.")) return;
    const r = await fetch(`/api/admin/providers/${id}`, { method: "DELETE" });
    if (r.ok) { setItems(items.filter((p) => p.id !== id)); router.refresh(); }
    else { const d = await r.json().catch(() => ({})); alert(d.error || "Lỗi"); }
  }

  async function toggleKeyEnabled(providerId: string, keyId: string, enabled: boolean) {
    const r = await fetch(`/api/admin/providers/${providerId}/keys/${keyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!r.ok) return;
    const k = await r.json();
    setItems(items.map((p) => p.id !== providerId ? p : {
      ...p,
      keys: p.keys.map((x) => x.id === keyId ? { ...x, ...k, createdAt: k.createdAt ? new Date(k.createdAt).toISOString() : x.createdAt, lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt).toISOString() : x.lastUsedAt, lastErrorAt: k.lastErrorAt ? new Date(k.lastErrorAt).toISOString() : x.lastErrorAt } : x),
    }));
  }

  async function resetKeyErrors(providerId: string, keyId: string) {
    const r = await fetch(`/api/admin/providers/${providerId}/keys/${keyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetErrors: true }),
    });
    if (!r.ok) return;
    setItems(items.map((p) => p.id !== providerId ? p : {
      ...p,
      keys: p.keys.map((x) => x.id === keyId ? { ...x, errorCount: 0, lastErrorAt: null } : x),
    }));
  }

  async function delKey(providerId: string, keyId: string) {
    if (!confirm("Xóa key này?")) return;
    const r = await fetch(`/api/admin/providers/${providerId}/keys/${keyId}`, { method: "DELETE" });
    if (!r.ok) return;
    setItems(items.map((p) => p.id !== providerId ? p : {
      ...p,
      keys: p.keys.filter((x) => x.id !== keyId),
    }));
  }

  async function addKeyToProvider(providerId: string) {
    if (!newKey.trim()) { alert("Thiếu API key"); return; }
    const r = await fetch(`/api/admin/providers/${providerId}/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newKey.trim(), label: newKeyLabel.trim() || null }),
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Lỗi"); return; }
    setAddingKeyTo(null);
    setNewKey(""); setNewKeyLabel(""); setShowNewKey(false);
    router.refresh();
    // refetch để có lại key list
    const list = await fetch("/api/admin/providers");
    if (list.ok) {
      const fresh: any[] = await list.json();
      setItems(fresh.map((p) => ({
        ...p,
        modelsCount: p._count?.models ?? 0,
        createdAt: p.createdAt,
        keys: p.keys.map((k: any) => ({ ...k, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt, lastErrorAt: k.lastErrorAt })),
      })));
    }
  }

  const currentTypeMeta = editing ? PROVIDER_TYPES.find((t) => t.value === editing.type) : null;

  return (
    <>
      <div className="flex justify-end">
        <button onClick={startCreate} className="btn btn-primary">
          <Plus size={14} /> Tạo Provider Mới
        </button>
      </div>

      {/* MODAL: CREATE / EDIT */}
      {editing && (
        <div className="card p-5 border-honey-500/30">
          <div className="flex items-center justify-between mb-4">
            <p className="font-medium text-lg">
              {editing.id ? "Sửa Provider" : "Tạo Provider Mới"}
            </p>
            <button onClick={() => setEditing(null)}><X size={16} /></button>
          </div>

          <div className="space-y-5">
            {/* Name */}
            <div>
              <label className="label">Tên Provider <span className="text-rose-400">*</span></label>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="input"
                placeholder="VD: My OpenAI Provider"
              />
            </div>

            {/* Description */}
            <div>
              <label className="label">Mô tả</label>
              <textarea
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="input resize-none"
                rows={2}
                placeholder="Ghi chú nội bộ (tùy chọn)"
              />
            </div>

            {/* Provider Type cards */}
            <div>
              <label className="label">Loại Provider <span className="text-rose-400">*</span></label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-1">
                {PROVIDER_TYPES.map((t) => {
                  const active = editing.type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setEditing({ ...editing, type: t.value })}
                      className={`rounded-xl border p-3 text-left transition ${
                        active
                          ? "border-honey-400 bg-honey-400/10 ring-1 ring-honey-400/40"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="text-xl mb-1">{t.emoji}</div>
                      <div className="text-sm font-medium">{t.label}</div>
                      <div className="text-[10px] text-ink-200/50 mt-0.5">{t.example}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Base URL (conditional) */}
            {currentTypeMeta?.needsBaseUrl && (
              <div>
                <label className="label">
                  Base URL <span className="text-rose-400">*</span>
                </label>
                <input
                  value={editing.baseUrl}
                  onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
                  className="input"
                  placeholder={editing.type === "OLLAMA" ? "http://localhost:11434" : "https://api.example.com/v1"}
                />
                <p className="text-xs text-ink-200/50 mt-1">
                  Không bao gồm <code>/chat/completions</code> hay <code>/messages</code> ở cuối.
                </p>
              </div>
            )}
            {!currentTypeMeta?.needsBaseUrl && (
              <div>
                <label className="label">Base URL (tùy chọn)</label>
                <input
                  value={editing.baseUrl}
                  onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
                  className="input"
                  placeholder="Để trống = dùng endpoint mặc định của nhà cung cấp"
                />
              </div>
            )}

            {/* API Keys (only when creating new) */}
            {!editing.id && (
              <div>
                <label className="label flex items-center justify-between">
                  <span>API Keys <span className="text-rose-400">*</span></span>
                  <span className="text-xs text-ink-200/50">{editing.keys.filter((k) => k.trim()).length} key(s)</span>
                </label>
                <div className="space-y-2">
                  {editing.keys.map((k, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showKey[i] ? "text" : "password"}
                          value={k}
                          onChange={(e) => {
                            const next = [...editing.keys]; next[i] = e.target.value;
                            setEditing({ ...editing, keys: next });
                          }}
                          className="input pr-9"
                          placeholder="sk-..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey({ ...showKey, [i]: !showKey[i] })}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-200/40 hover:text-ink-200/80"
                        >
                          {showKey[i] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {editing.keys.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = editing.keys.filter((_, idx) => idx !== i);
                            setEditing({ ...editing, keys: next });
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
                  onClick={() => setEditing({ ...editing, keys: [...editing.keys, ""] })}
                  className="mt-2 text-xs text-honey-300 hover:text-honey-200 flex items-center gap-1"
                >
                  <Plus size={12} /> Thêm API Key
                </button>
              </div>
            )}

            {/* Routing strategy */}
            <div>
              <label className="label">Routing Strategy</label>
              <select
                value={editing.routing}
                onChange={(e) => setEditing({ ...editing, routing: e.target.value })}
                className="input"
              >
                {ROUTING_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label} — {r.desc}
                  </option>
                ))}
              </select>
            </div>

            {/* Enabled */}
            <div className="flex items-center gap-2">
              <input
                id="provider-enabled"
                type="checkbox"
                checked={editing.enabled}
                onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
              />
              <label htmlFor="provider-enabled" className="text-sm">Provider đang bật</label>
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <button
              disabled={loading}
              onClick={save}
              className="btn btn-primary bg-gradient-to-r from-blue-500 to-purple-500 border-none text-white"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {editing.id ? "Lưu thay đổi" : "Tạo Provider"}
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-ghost">Hủy</button>
          </div>
        </div>
      )}

      {/* PROVIDER LIST */}
      <div className="space-y-3">
        {items.length === 0 && (
          <div className="card p-8 text-center text-ink-200/60">
            <Network size={28} className="mx-auto mb-2 opacity-40" />
            <p>Chưa có Provider nào. Models hiện dùng env fallback <code>BEEKNOEE_BASE_URL</code>.</p>
          </div>
        )}

        {items.map((p) => {
          const typeMeta = PROVIDER_TYPES.find((t) => t.value === p.type);
          const isExpanded = expanded[p.id];
          const healthyKeys = p.keys.filter((k) => k.enabled && k.errorCount < 3).length;
          return (
            <div key={p.id} className="card overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <button
                  onClick={() => setExpanded({ ...expanded, [p.id]: !isExpanded })}
                  className="text-ink-200/40 hover:text-ink-200/80"
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div className="text-2xl">{typeMeta?.emoji ?? "🔌"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{p.name}</p>
                    <span className="badge bg-white/5 text-xs">{typeMeta?.label ?? p.type}</span>
                    <span className={`badge text-xs ${p.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-700/40 text-ink-200/50"}`}>
                      {p.enabled ? "ON" : "OFF"}
                    </span>
                    <span className="badge bg-white/5 text-xs">{p.routing.replace("_", " ")}</span>
                  </div>
                  <div className="text-xs text-ink-200/50 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><KeyIcon size={10} /> {healthyKeys}/{p.keys.length} key khỏe</span>
                    <span>{p.modelsCount} model</span>
                    {p.baseUrl && <span className="font-mono truncate max-w-[300px]">{p.baseUrl}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(p)} className="btn btn-ghost text-xs"><Edit size={12} /></button>
                  <button onClick={() => delProvider(p.id)} className="btn btn-danger text-xs"><Trash2 size={12} /></button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-white/5 p-4 space-y-3 bg-black/20">
                  {p.description && (
                    <p className="text-xs text-ink-200/60 italic">{p.description}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-200/40">API Keys</p>
                    {addingKeyTo !== p.id && (
                      <button
                        onClick={() => { setAddingKeyTo(p.id); setNewKey(""); setNewKeyLabel(""); }}
                        className="text-xs text-honey-300 hover:text-honey-200 flex items-center gap-1"
                      >
                        <Plus size={12} /> Thêm key
                      </button>
                    )}
                  </div>

                  {addingKeyTo === p.id && (
                    <div className="card p-3 border-honey-500/30 space-y-2">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showNewKey ? "text" : "password"}
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            className="input pr-9"
                            placeholder="sk-..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewKey(!showNewKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-200/40 hover:text-ink-200/80"
                          >
                            {showNewKey ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        <input
                          value={newKeyLabel}
                          onChange={(e) => setNewKeyLabel(e.target.value)}
                          className="input w-40"
                          placeholder="Label (vd: Key trial)"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => addKeyToProvider(p.id)} className="btn btn-primary text-xs">Thêm</button>
                        <button onClick={() => { setAddingKeyTo(null); setNewKey(""); setNewKeyLabel(""); }} className="btn btn-ghost text-xs">Hủy</button>
                      </div>
                    </div>
                  )}

                  {p.keys.length === 0 ? (
                    <p className="text-xs text-ink-200/40 italic">Chưa có key nào.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className="table-th">Prefix</th>
                            <th className="table-th">Label</th>
                            <th className="table-th">Status</th>
                            <th className="table-th text-right">Requests</th>
                            <th className="table-th text-right">Errors</th>
                            <th className="table-th">Lần cuối</th>
                            <th className="table-th text-right"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.keys.map((k) => {
                            const inCooldown = k.errorCount >= 3;
                            return (
                              <tr key={k.id}>
                                <td className="table-td font-mono text-xs">{k.prefix}…</td>
                                <td className="table-td text-xs">{k.label ?? "—"}</td>
                                <td className="table-td">
                                  {!k.enabled ? (
                                    <span className="badge bg-ink-700/40 text-ink-200/50 text-xs">OFF</span>
                                  ) : inCooldown ? (
                                    <span className="badge bg-amber-500/15 text-amber-300 text-xs flex items-center gap-1 w-fit">
                                      <AlertTriangle size={10} /> Cooldown
                                    </span>
                                  ) : (
                                    <span className="badge bg-emerald-500/15 text-emerald-300 text-xs flex items-center gap-1 w-fit">
                                      <CheckCircle2 size={10} /> OK
                                    </span>
                                  )}
                                </td>
                                <td className="table-td text-right text-xs">{k.totalRequests.toLocaleString()}</td>
                                <td className="table-td text-right text-xs">
                                  <span className={k.errorCount > 0 ? "text-rose-300" : ""}>{k.totalErrors.toLocaleString()}</span>
                                  {k.errorCount > 0 && (
                                    <span className="ml-1 text-amber-300">({k.errorCount}/3)</span>
                                  )}
                                </td>
                                <td className="table-td text-xs text-ink-200/60">{fmtDate(k.lastUsedAt)}</td>
                                <td className="table-td text-right">
                                  <div className="flex gap-1 justify-end">
                                    {k.errorCount > 0 && (
                                      <button
                                        onClick={() => resetKeyErrors(p.id, k.id)}
                                        className="btn btn-ghost text-xs"
                                        title="Reset error count"
                                      >
                                        <RefreshCw size={11} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => toggleKeyEnabled(p.id, k.id, !k.enabled)}
                                      className="btn btn-ghost text-xs"
                                      title={k.enabled ? "Tắt" : "Bật"}
                                    >
                                      {k.enabled ? "Tắt" : "Bật"}
                                    </button>
                                    <button onClick={() => delKey(p.id, k.id)} className="btn btn-danger text-xs">
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
