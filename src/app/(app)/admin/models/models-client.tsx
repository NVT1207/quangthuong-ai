"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2, X, Loader2 } from "lucide-react";
import { formatNumber } from "@/lib/format";

type M = {
  id: string; slug: string; displayName: string; provider: string;
  category: string; priceUnit: string;
  inputPrice: number; outputPrice: number; contextLength: number;
  description: string | null; active: boolean; createdAt: string;
  freeDiscount: number; basicDiscount: number; advDiscount: number;
  speedTps: number; latencyMs: number; uptimeStatus: string;
};

const CATEGORIES = ["text", "embedding", "image", "video", "tts"] as const;
const PRICE_UNITS = ["1M tokens", "1 ảnh", "1 giây", "1M ký tự"] as const;

const blank: Partial<M> = {
  slug: "", displayName: "", provider: "openai",
  category: "text", priceUnit: "1M tokens",
  inputPrice: 0, outputPrice: 0, contextLength: 128000,
  description: "", active: true,
  freeDiscount: 50, basicDiscount: 60, advDiscount: 70,
  speedTps: 0, latencyMs: 0, uptimeStatus: "good",
};

const UPTIME_DOT: Record<string, string> = {
  good: "bg-emerald-400",
  warn: "bg-amber-400",
  down: "bg-rose-400",
};

export function ModelsAdminClient({ initial }: { initial: M[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Partial<M> | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!editing) return;
    setLoading(true);
    const isNew = !editing.id;
    const r = await fetch(`/api/admin/models${isNew ? "" : "/" + editing.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing),
    });
    setLoading(false);
    if (!r.ok) { const d = await r.json(); alert(d.error || "Lỗi"); return; }
    setEditing(null); router.refresh();
    const data = await r.json();
    if (isNew) setItems([...items, data]); else setItems(items.map((m) => m.id === data.id ? data : m));
  }

  async function del(id: string) {
    if (!confirm("Xóa model này?")) return;
    const r = await fetch(`/api/admin/models/${id}`, { method: "DELETE" });
    if (r.ok) { setItems(items.filter((m) => m.id !== id)); router.refresh(); }
  }

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setEditing(blank)} className="btn btn-primary"><Plus size={14} /> Thêm model</button>
      </div>

      {editing && (
        <div className="card p-5 border-honey-500/30">
          <div className="flex items-center justify-between mb-4">
            <p className="font-medium">{editing.id ? "Sửa model" : "Thêm model mới"}</p>
            <button onClick={() => setEditing(null)}><X size={16} /></button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="label">Slug (unique)</label><input value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="input" placeholder="claude-sonnet-4.6" /></div>
            <div><label className="label">Tên hiển thị</label><input value={editing.displayName || ""} onChange={(e) => setEditing({ ...editing, displayName: e.target.value })} className="input" placeholder="Claude Sonnet 4.6" /></div>
            <div><label className="label">Provider</label>
              <select value={editing.provider || ""} onChange={(e) => setEditing({ ...editing, provider: e.target.value })} className="input">
                {["openai", "anthropic", "google", "deepseek", "grok", "meta", "mistral", "other"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
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
            <div><label className="label">Giá input (₫/1M token)</label><input type="number" value={editing.inputPrice || 0} onChange={(e) => setEditing({ ...editing, inputPrice: parseFloat(e.target.value) || 0 })} className="input" /></div>
            <div><label className="label">Giá output (₫/1M token)</label><input type="number" value={editing.outputPrice || 0} onChange={(e) => setEditing({ ...editing, outputPrice: parseFloat(e.target.value) || 0 })} className="input" /></div>

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
          <div className="flex gap-2 mt-4">
            <button disabled={loading} onClick={save} className="btn btn-primary">{loading && <Loader2 size={14} className="animate-spin" />} Lưu</button>
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
            {items.map((m) => (
              <tr key={m.id}>
                <td className="table-td"><p className="font-medium">{m.displayName}</p><p className="text-xs text-ink-200/50 font-mono">{m.slug}</p></td>
                <td className="table-td"><span className="badge bg-white/5">{m.provider}</span></td>
                <td className="table-td text-right text-honey-300">{formatNumber(m.inputPrice)} ₫</td>
                <td className="table-td text-right text-honey-300">{formatNumber(m.outputPrice)} ₫</td>
                <td className="table-td text-right">{formatNumber(m.contextLength)}</td>
                <td className="table-td text-center text-xs text-ink-200/70">{m.freeDiscount}/{m.basicDiscount}/{m.advDiscount}%</td>
                <td className="table-td text-center"><span className={`inline-block w-2 h-2 rounded-full ${UPTIME_DOT[m.uptimeStatus] ?? "bg-white/30"}`} title={m.uptimeStatus} /></td>
                <td className="table-td"><span className={`badge ${m.active ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-700/40 text-ink-200/50"}`}>{m.active ? "ON" : "OFF"}</span></td>
                <td className="table-td text-right">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => setEditing(m)} className="btn btn-ghost text-xs"><Edit size={12} /></button>
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
