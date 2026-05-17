"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Copy, Check, KeyRound, AlertTriangle, Search, Pencil, Eye, EyeOff, Loader2 } from "lucide-react";
import type { ModelOpt } from "./cli-panels";
import { KeyDetailModal } from "./key-detail-modal";
import { formatUSD, formatNumber } from "@/lib/format";

type Key = {
  id: string;
  name: string;
  prefix: string;
  suffix: string;
  enabled: boolean;
  totalCost: number;
  totalRequests: number;
  createdAt: string;
  lastUsedAt: string | null;
};

type Props = {
  initial: Key[];
  models: ModelOpt[];
  modelCount: number;
  baseUrl: string;
};

export function KeysClient({ initial, models, modelCount, baseUrl }: Props) {
  const router = useRouter();
  const [keys, setKeys] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedReveal, setCopiedReveal] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [detailKeyId, setDetailKeyId] = useState<string | null>(null);
  // Map keyId → full key plaintext (sau khi reveal). Không persist; tự xoá khi đóng trang.
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);

  const filtered = search.trim()
    ? keys.filter(
        (k) =>
          k.name.toLowerCase().includes(search.toLowerCase()) ||
          k.prefix.toLowerCase().includes(search.toLowerCase()),
      )
    : keys;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const r = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await r.json();
    if (!r.ok) { alert(data.error || "Lỗi"); return; }
    setRevealedKey(data.fullKey);
    setKeys([{ ...data.key, enabled: true, totalCost: 0, totalRequests: 0 }, ...keys]);
    // Auto-reveal key vừa tạo trong list — user thấy ngay full key, không cần bấm 👁.
    // Reload trang sẽ về dạng ẩn (vì revealed state chỉ in-memory, không persist).
    setRevealed((prev) => ({ ...prev, [data.key.id]: data.fullKey }));
    setCreating(false);
    setName("");
    router.refresh();
  }

  async function revoke(id: string) {
    if (!confirm("Thu hồi key này? Các request đang dùng sẽ thất bại.")) return;
    const r = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    if (r.ok) {
      setKeys(keys.filter((k) => k.id !== id));
      router.refresh();
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, enabled } : k)));
    const r = await fetch(`/api/keys/${id}/toggle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!r.ok) {
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, enabled: !enabled } : k)));
      alert("Không cập nhật được trạng thái");
    }
  }

  function startEdit(k: Key) {
    setEditingId(k.id);
    setEditName(k.name);
  }

  async function saveEdit(id: string) {
    const newName = editName.trim();
    if (!newName) { setEditingId(null); return; }
    const r = await fetch(`/api/keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (r.ok) {
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, name: newName } : k)));
    }
    setEditingId(null);
  }

  function copyPrefix(k: Key) {
    const text = revealed[k.id] || `${k.prefix}...${k.suffix}`;
    navigator.clipboard.writeText(text);
    setCopiedKeyId(k.id);
    setTimeout(() => setCopiedKeyId(null), 1200);
  }

  async function toggleReveal(k: Key) {
    if (revealed[k.id]) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[k.id];
        return next;
      });
      return;
    }
    setRevealing(k.id);
    try {
      const r = await fetch(`/api/keys/${k.id}/reveal`);
      const data = await r.json();
      if (!r.ok) {
        alert(data.error || "Không hiện được key");
        return;
      }
      setRevealed((prev) => ({ ...prev, [k.id]: data.fullKey }));
    } catch {
      alert("Lỗi mạng");
    } finally {
      setRevealing(null);
    }
  }

  return (
    <>
      {revealedKey && (
        <div className="card p-5 border-honey-500/30 bg-honey-500/5">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="text-honey-400 shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="font-medium text-honey-300">Lưu key này ngay!</p>
              <p className="text-sm text-ink-200/70 mt-1">Đây là lần duy nhất bạn thấy key đầy đủ. Đóng dialog là không xem lại được.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <code className="flex-1 input font-mono text-sm">{revealedKey}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(revealedKey);
                setCopiedReveal(true);
                setTimeout(() => setCopiedReveal(false), 1500);
              }}
              className="btn btn-primary"
            >
              {copiedReveal ? <Check size={14} /> : <Copy size={14} />} {copiedReveal ? "Đã copy" : "Copy"}
            </button>
          </div>
          <button onClick={() => setRevealedKey(null)} className="btn btn-ghost mt-3 text-xs">Tôi đã lưu, đóng</button>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-ink-200/40" />
            <h2 className="text-sm font-mono uppercase tracking-wider text-ink-100">
              Danh sách API Keys <span className="text-ink-200/40">({keys.length})</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc prefix..."
              className="input text-sm w-56 hidden sm:block"
            />
            {!creating && (
              <button onClick={() => setCreating(true)} className="btn btn-primary"><Plus size={14} /> Tạo key mới</button>
            )}
          </div>
        </div>

        {creating && (
          <form onSubmit={create} className="flex gap-2 mb-4">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên gợi nhớ — VD: Production, App test" className="input flex-1" />
            <button className="btn btn-primary">Tạo</button>
            <button type="button" onClick={() => { setCreating(false); setName(""); }} className="btn btn-ghost">Hủy</button>
          </form>
        )}

        {keys.length === 0 ? (
          <div className="text-center py-12">
            <KeyRound className="mx-auto text-ink-200/30 mb-3" size={32} />
            <p className="text-sm text-ink-200/50">Chưa có API key nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Tên</th>
                  <th className="table-th">Key Prefix</th>
                  <th className="table-th">Subscriptions</th>
                  <th className="table-th">Tổng Requests</th>
                  <th className="table-th">Tổng Chi</th>
                  <th className="table-th">Trạng Thái</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((k) => (
                  <tr key={k.id} className="group">
                    <td className="table-td font-medium">
                      {editingId === k.id ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={() => saveEdit(k.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(k.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="input text-sm py-1 w-40"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {k.name}
                          <button onClick={() => startEdit(k)} className="opacity-0 group-hover:opacity-100 text-ink-200/40 hover:text-ink-100 transition">
                            <Pencil size={11} />
                          </button>
                        </span>
                      )}
                    </td>
                    <td className="table-td">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => copyPrefix(k)}
                          className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-lg bg-ink-950/60 border border-white/5 hover:border-white/15 transition max-w-[280px]"
                          title={revealed[k.id] ? "Copy full key" : "Copy prefix"}
                        >
                          {copiedKeyId === k.id ? <Check size={11} className="text-emerald-300 shrink-0" /> : <Copy size={11} className="text-ink-200/40 shrink-0" />}
                          <span className="truncate">
                            {revealed[k.id] ? revealed[k.id] : `${k.prefix}...${k.suffix}`}
                          </span>
                        </button>
                        <button
                          onClick={() => toggleReveal(k)}
                          disabled={revealing === k.id}
                          className="p-1.5 rounded-lg text-ink-200/50 hover:text-ink-100 hover:bg-white/5 transition disabled:opacity-50"
                          title={revealed[k.id] ? "Ẩn key" : "Hiện full key"}
                        >
                          {revealing === k.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : revealed[k.id]
                              ? <EyeOff size={12} />
                              : <Eye size={12} />}
                        </button>
                      </div>
                    </td>
                    <td className="table-td">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20 text-xs font-mono">
                        {modelCount} model(s)
                      </span>
                    </td>
                    <td className="table-td font-mono">{formatNumber(k.totalRequests)}</td>
                    <td className="table-td font-mono">
                      <span className={k.totalCost > 0 ? "text-emerald-400" : "text-ink-200/50"}>{formatUSD(k.totalCost)}</span>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <Toggle on={k.enabled} onChange={(v) => toggleEnabled(k.id, v)} />
                        <span
                          className={
                            k.enabled
                              ? "text-[11px] font-medium px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "text-[11px] font-medium px-1.5 py-0.5 rounded border border-ink-500/30 bg-ink-500/10 text-ink-200/60"
                          }
                        >
                          {k.enabled ? "Active" : "Tắt"}
                        </span>
                      </div>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setDetailKeyId(k.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-md shadow-sky-500/20 hover:from-sky-400 hover:to-violet-400 transition"
                        >
                          <Eye size={12} /> Xem chi tiết
                        </button>
                        <button onClick={() => revoke(k.id)} className="p-1.5 rounded-lg text-rose-300/70 hover:text-rose-300 hover:bg-rose-500/10 transition" title="Thu hồi key">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailKeyId && (() => {
        const k = keys.find((x) => x.id === detailKeyId);
        if (!k) return null;
        return (
          <KeyDetailModal
            keyId={detailKeyId}
            onClose={() => setDetailKeyId(null)}
            baseUrl={baseUrl}
            models={models}
            keyItem={{ id: k.id, name: k.name, prefix: k.prefix, suffix: k.suffix }}
            revealed={revealed}
          />
        );
      })()}
    </>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 rounded-full transition shrink-0 ${on ? "bg-emerald-500/80" : "bg-ink-700"}`}
      title={on ? "Đang bật" : "Đang tắt"}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}
