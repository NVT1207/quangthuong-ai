"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2, X, Loader2, Tag, Calendar, Users, Sparkles, AlertTriangle } from "lucide-react";
import { formatVND } from "@/lib/format";

type PromoItem = {
  id: string;
  code: string;
  description: string | null;
  bonusType: string;
  bonusPercent: number;
  bonusAmount: number;
  minAmount: number;
  maxBonus: number | null;
  firstUseOnly: boolean;
  enabled: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  redemptionCount: number;
  createdAt: string;
};

type Editing = {
  id?: string;
  code: string;
  description: string;
  bonusType: string;
  bonusPercent: number;
  bonusAmount: number;
  minAmount: number;
  maxBonus: string; // empty = unlimited
  firstUseOnly: boolean;
  enabled: boolean;
  startsAt: string; // datetime-local
  expiresAt: string; // datetime-local
  maxUses: string; // empty = unlimited
};

const blank: Editing = {
  code: "",
  description: "",
  bonusType: "PERCENT",
  bonusPercent: 10,
  bonusAmount: 0,
  minAmount: 0,
  maxBonus: "",
  firstUseOnly: false,
  enabled: true,
  startsAt: "",
  expiresAt: "",
  maxUses: "",
};

// Format ISO → "YYYY-MM-DDTHH:mm" cho input datetime-local theo giờ địa phương.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "YYYY-MM-DDTHH:mm" (local) → ISO. Empty → null.
function localInputToIso(s: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", { hour12: false });
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export function PromoCodesClient({ initial }: { initial: PromoItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function startCreate() {
    setEditing({ ...blank });
    setErr("");
  }

  function startEdit(p: PromoItem) {
    setEditing({
      id: p.id,
      code: p.code,
      description: p.description ?? "",
      bonusType: p.bonusType,
      bonusPercent: p.bonusPercent,
      bonusAmount: p.bonusAmount,
      minAmount: p.minAmount,
      maxBonus: p.maxBonus != null ? String(p.maxBonus) : "",
      firstUseOnly: p.firstUseOnly,
      enabled: p.enabled,
      startsAt: isoToLocalInput(p.startsAt),
      expiresAt: isoToLocalInput(p.expiresAt),
      maxUses: p.maxUses != null ? String(p.maxUses) : "",
    });
    setErr("");
  }

  async function save() {
    if (!editing) return;
    setLoading(true);
    setErr("");
    const payload = {
      code: editing.code.trim().toUpperCase(),
      description: editing.description.trim() || null,
      bonusType: editing.bonusType,
      bonusPercent: Number(editing.bonusPercent) || 0,
      bonusAmount: Number(editing.bonusAmount) || 0,
      minAmount: Number(editing.minAmount) || 0,
      maxBonus: editing.maxBonus === "" ? null : Number(editing.maxBonus),
      firstUseOnly: editing.firstUseOnly,
      enabled: editing.enabled,
      startsAt: localInputToIso(editing.startsAt),
      expiresAt: localInputToIso(editing.expiresAt),
      maxUses: editing.maxUses === "" ? null : Number(editing.maxUses),
    };

    try {
      const url = editing.id ? `/api/admin/promo-codes/${editing.id}` : "/api/admin/promo-codes";
      const method = editing.id ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || "Có lỗi xảy ra");
      } else {
        setEditing(null);
        router.refresh();
      }
    } catch (e: any) {
      setErr(e.message || "Lỗi mạng");
    } finally {
      setLoading(false);
    }
  }

  async function remove(p: PromoItem) {
    if (!confirm(`Xoá mã "${p.code}"? Hành động này không thể hoàn tác.`)) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/promo-codes/${p.id}`, { method: "DELETE" });
      if (r.ok) {
        setItems((arr) => arr.filter((x) => x.id !== p.id));
        router.refresh();
      } else {
        const d = await r.json();
        alert(d.error || "Không xoá được");
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleEnabled(p: PromoItem) {
    setLoading(true);
    try {
      await fetch(`/api/admin/promo-codes/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !p.enabled }),
      });
      setItems((arr) => arr.map((x) => (x.id === p.id ? { ...x, enabled: !x.enabled } : x)));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function seedApiondinh() {
    if (!confirm('Tạo/Reset mã "APIONDINH" (+10%, min 3M, lần đầu, hết hạn 25/5/2026)?')) return;
    setLoading(true);
    try {
      const r = await fetch("/api/admin/promo-codes/seed-apiondinh", { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        alert(d.message);
        router.refresh();
      } else {
        alert(d.error || "Có lỗi");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button onClick={seedApiondinh} disabled={loading} className="btn btn-ghost text-sm gap-1.5">
          <Sparkles size={14} /> Seed APIONDINH
        </button>
        <button onClick={startCreate} className="btn btn-primary text-sm gap-1.5">
          <Plus size={14} /> Tạo mã mới
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-950/50 text-ink-200/60 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Mã</th>
                <th className="text-left px-4 py-3">Bonus</th>
                <th className="text-left px-4 py-3">Min nạp</th>
                <th className="text-left px-4 py-3">Hạn dùng</th>
                <th className="text-left px-4 py-3">Lượt dùng</th>
                <th className="text-left px-4 py-3">Trạng thái</th>
                <th className="text-right px-4 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-ink-200/40">
                    Chưa có mã ưu đãi nào. Click "Tạo mã mới" để bắt đầu.
                  </td>
                </tr>
              )}
              {items.map((p) => {
                const expired = isExpired(p.expiresAt);
                const exhausted = p.maxUses != null && p.usedCount >= p.maxUses;
                return (
                  <tr key={p.id} className="hover:bg-ink-950/30">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold tracking-wider text-honey-200">{p.code}</div>
                      {p.description && (
                        <div className="text-[11px] text-ink-200/50 mt-0.5">{p.description}</div>
                      )}
                      <div className="flex gap-1 mt-1">
                        {p.firstUseOnly && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25">
                            Lần đầu
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.bonusType === "PERCENT" ? (
                        <span className="font-semibold text-emerald-300">+{p.bonusPercent}%</span>
                      ) : (
                        <span className="font-semibold text-emerald-300">+{formatVND(p.bonusAmount)}</span>
                      )}
                      {p.maxBonus && (
                        <div className="text-[10px] text-ink-200/40">cap {formatVND(p.maxBonus)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-100/85">
                      {p.minAmount > 0 ? formatVND(p.minAmount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-1 text-ink-200/70">
                        <Calendar size={11} /> {fmtDate(p.expiresAt)}
                      </div>
                      {p.startsAt && (
                        <div className="text-[10px] text-ink-200/40 mt-0.5">từ {fmtDate(p.startsAt)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Users size={11} className="text-ink-200/40" />
                        <span className="font-semibold">{p.usedCount}</span>
                        {p.maxUses != null && <span className="text-ink-200/40">/ {p.maxUses}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {expired ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/25">
                          Hết hạn
                        </span>
                      ) : exhausted ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                          Hết lượt
                        </span>
                      ) : p.enabled ? (
                        <button onClick={() => toggleEnabled(p)} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25">
                          Đang hoạt động
                        </button>
                      ) : (
                        <button onClick={() => toggleEnabled(p)} className="text-[10px] px-2 py-0.5 rounded bg-ink-700/40 text-ink-200/60 border border-white/10 hover:bg-ink-700/60">
                          Đã tắt
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => startEdit(p)}
                          className="p-1.5 rounded hover:bg-white/5 text-ink-200/70 hover:text-white"
                          title="Sửa"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => remove(p)}
                          disabled={loading}
                          className="p-1.5 rounded hover:bg-rose-500/10 text-rose-300/70 hover:text-rose-300"
                          title="Xoá"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditModal
          editing={editing}
          setEditing={setEditing}
          onSave={save}
          onClose={() => setEditing(null)}
          loading={loading}
          err={err}
        />
      )}
    </div>
  );
}

function EditModal({
  editing,
  setEditing,
  onSave,
  onClose,
  loading,
  err,
}: {
  editing: Editing;
  setEditing: (e: Editing) => void;
  onSave: () => void;
  onClose: () => void;
  loading: boolean;
  err: string;
}) {
  const isEdit = !!editing.id;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-ink-900 border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-honey-300" />
            <h3 className="font-semibold">{isEdit ? "Sửa mã ưu đãi" : "Tạo mã ưu đãi mới"}</h3>
          </div>
          <button onClick={onClose} className="text-ink-200/60 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Code */}
          <div>
            <label className="label">Mã (UPPERCASE, không dấu)</label>
            <input
              value={editing.code}
              onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })}
              disabled={isEdit}
              placeholder="APIONDINH"
              className="input font-mono tracking-wider uppercase"
              maxLength={32}
            />
            {isEdit && <p className="text-[11px] text-ink-200/40 mt-1">Không thể đổi mã sau khi tạo.</p>}
          </div>

          {/* Description */}
          <div>
            <label className="label">Mô tả (tùy chọn)</label>
            <input
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="Khuyến mãi mở khóa API Quang Thưởng AI, lần đầu nạp 3M+"
              className="input"
              maxLength={500}
            />
          </div>

          {/* Bonus type + value */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Loại bonus</label>
              <select
                value={editing.bonusType}
                onChange={(e) => setEditing({ ...editing, bonusType: e.target.value })}
                className="input"
              >
                <option value="PERCENT">Phần trăm (%)</option>
                <option value="FIXED">Số tiền cố định (₫)</option>
              </select>
            </div>
            {editing.bonusType === "PERCENT" ? (
              <div>
                <label className="label">Bonus (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={editing.bonusPercent}
                  onChange={(e) => setEditing({ ...editing, bonusPercent: Number(e.target.value) })}
                  className="input"
                />
              </div>
            ) : (
              <div>
                <label className="label">Bonus (₫)</label>
                <input
                  type="number"
                  value={editing.bonusAmount}
                  onChange={(e) => setEditing({ ...editing, bonusAmount: Number(e.target.value) })}
                  className="input"
                />
              </div>
            )}
          </div>

          {/* Min amount + Max bonus */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Số nạp tối thiểu (₫)</label>
              <input
                type="number"
                value={editing.minAmount}
                onChange={(e) => setEditing({ ...editing, minAmount: Number(e.target.value) })}
                placeholder="0 = không giới hạn"
                className="input"
              />
              {editing.minAmount > 0 && (
                <p className="text-[11px] text-ink-200/40 mt-1">= {formatVND(editing.minAmount)}</p>
              )}
            </div>
            <div>
              <label className="label">Cap bonus (₫, tùy chọn)</label>
              <input
                type="number"
                value={editing.maxBonus}
                onChange={(e) => setEditing({ ...editing, maxBonus: e.target.value })}
                placeholder="Để trống = không cap"
                className="input"
              />
            </div>
          </div>

          {/* Time range */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Bắt đầu (tùy chọn)</label>
              <input
                type="datetime-local"
                value={editing.startsAt}
                onChange={(e) => setEditing({ ...editing, startsAt: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Hết hạn (tùy chọn)</label>
              <input
                type="datetime-local"
                value={editing.expiresAt}
                onChange={(e) => setEditing({ ...editing, expiresAt: e.target.value })}
                className="input"
              />
            </div>
          </div>

          {/* Max uses */}
          <div>
            <label className="label">Tổng lượt dùng tối đa (tùy chọn)</label>
            <input
              type="number"
              value={editing.maxUses}
              onChange={(e) => setEditing({ ...editing, maxUses: e.target.value })}
              placeholder="Để trống = không giới hạn"
              className="input"
            />
          </div>

          {/* Flags */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.firstUseOnly}
                onChange={(e) => setEditing({ ...editing, firstUseOnly: e.target.checked })}
              />
              <span className="text-sm">Chỉ áp dụng cho lần đầu dùng mã (mỗi user 1 lần)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.enabled}
                onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
              />
              <span className="text-sm">Kích hoạt mã</span>
            </label>
          </div>

          {err && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2.5 text-xs text-ink-100/85 flex items-start gap-2">
            <Sparkles size={12} className="text-sky-300 mt-0.5 shrink-0" />
            <span>
              Mã sẽ tự động <b>từ chối</b> khi hết hạn, vượt số lượt, hoặc user đã từng dùng (nếu bật "Lần đầu").
              Bonus snapshot lúc tạo topup — admin sửa mã sau không ảnh hưởng topup đang pending.
            </span>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-white/5 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="btn btn-ghost text-sm">Hủy</button>
          <button
            onClick={onSave}
            disabled={loading || !editing.code}
            className="btn btn-primary text-sm gap-1.5"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
            {isEdit ? "Lưu thay đổi" : "Tạo mã"}
          </button>
        </div>
      </div>
    </div>
  );
}
