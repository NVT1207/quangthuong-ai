"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { formatVND, formatDate } from "@/lib/format";
import { Loader2 } from "lucide-react";

type U = { id: string; email: string; name: string | null; balance: number; role: string; status: string; createdAt: string };

export function UsersClient({ users }: { users: U[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function adjust(userId: string) {
    if (!delta) return alert("Nhập số tiền cộng/trừ");
    setLoading(true);
    const r = await fetch(`/api/admin/users/${userId}/adjust`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: delta, reason }),
    });
    setLoading(false);
    if (!r.ok) { const d = await r.json(); alert(d.error || "Lỗi"); return; }
    setEditing(null); setDelta(0); setReason(""); router.refresh();
  }

  async function toggle(id: string, field: "role" | "status", value: string) {
    if (!confirm(`Đổi ${field} thành ${value}?`)) return;
    const r = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
    if (r.ok) router.refresh();
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="table-th">User</th>
            <th className="table-th">Role</th>
            <th className="table-th">Status</th>
            <th className="table-th text-right">Số dư</th>
            <th className="table-th">Tạo</th>
            <th className="table-th text-right">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <React.Fragment key={u.id}>
              <tr>
                <td className="table-td">
                  <p className="font-medium">{u.name || "—"}</p>
                  <p className="text-xs text-ink-200/50">{u.email}</p>
                </td>
                <td className="table-td">
                  <select value={u.role} onChange={(e) => toggle(u.id, "role", e.target.value)} className="input py-1 text-xs w-24">
                    <option value="USER">USER</option><option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td className="table-td">
                  <select value={u.status} onChange={(e) => toggle(u.id, "status", e.target.value)} className="input py-1 text-xs w-28">
                    <option value="ACTIVE">ACTIVE</option><option value="BANNED">BANNED</option>
                  </select>
                </td>
                <td className="table-td text-right font-medium text-honey-300">{formatVND(u.balance)}</td>
                <td className="table-td text-ink-200/60">{formatDate(u.createdAt)}</td>
                <td className="table-td text-right">
                  <button onClick={() => setEditing(editing === u.id ? null : u.id)} className="btn btn-ghost text-xs">
                    {editing === u.id ? "Hủy" : "+/- Balance"}
                  </button>
                </td>
              </tr>
              {editing === u.id && (
                <tr>
                  <td colSpan={6} className="table-td bg-white/[0.02]">
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="label">Số tiền (âm = trừ)</label>
                        <input type="number" value={delta} onChange={(e) => setDelta(parseInt(e.target.value) || 0)} className="input w-40" />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="label">Lý do</label>
                        <input value={reason} onChange={(e) => setReason(e.target.value)} className="input" />
                      </div>
                      <button disabled={loading} onClick={() => adjust(u.id)} className="btn btn-primary">
                        {loading && <Loader2 size={14} className="animate-spin" />} Áp dụng
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
