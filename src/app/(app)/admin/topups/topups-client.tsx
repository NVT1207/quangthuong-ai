"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { formatVND, formatDateTime } from "@/lib/format";

type T = {
  id: string; amount: number; method: string; reference: string | null; note: string | null;
  status: string; createdAt: string; processedAt: string | null;
  autoApproved: boolean;
  receivedAmount: number | null;
  userEmail: string; userName: string | null;
};

const STATUS: Record<string, string> = {
  PENDING: "bg-honey-500/15 text-honey-300",
  APPROVED: "bg-emerald-500/15 text-emerald-300",
  REJECTED: "bg-rose-500/15 text-rose-300",
};

export function TopupsClient({ items }: { items: T[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject") {
    if (action === "reject" && !confirm("Từ chối yêu cầu này?")) return;
    setLoading(id);
    const r = await fetch(`/api/admin/topups/${id}/${action}`, { method: "POST" });
    setLoading(null);
    if (r.ok) router.refresh();
    else { const d = await r.json(); alert(d.error || "Lỗi"); }
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="table-th">Ngày</th>
            <th className="table-th">Người dùng</th>
            <th className="table-th text-right">Số tiền</th>
            <th className="table-th">Phương thức</th>
            <th className="table-th">Mã GD</th>
            <th className="table-th">Trạng thái</th>
            <th className="table-th text-right"></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={7} className="table-td text-center py-12 text-ink-200/50">Không có yêu cầu</td></tr>
          ) : items.map((t) => (
            <tr key={t.id}>
              <td className="table-td text-ink-200/70">{formatDateTime(t.createdAt)}</td>
              <td className="table-td">
                <p className="font-medium text-sm">{t.userName || "—"}</p>
                <p className="text-xs text-ink-200/50">{t.userEmail}</p>
              </td>
              <td className="table-td text-right font-semibold text-honey-300">
                {formatVND(t.amount)}
                {t.receivedAmount != null && t.receivedAmount !== t.amount && (
                  <p className="text-[10px] font-normal text-ink-200/60 mt-0.5">
                    Thực nhận: <span className="text-emerald-300">{formatVND(t.receivedAmount)}</span>
                  </p>
                )}
              </td>
              <td className="table-td">{t.method === "bank" || t.method === "qr" ? "Bank/QR" : "MoMo"}</td>
              <td className="table-td text-ink-200/70 font-mono text-xs">{t.reference || "—"}</td>
              <td className="table-td">
                <span className={`badge ${STATUS[t.status]}`}>{t.status}</span>
                {t.autoApproved && t.status === "APPROVED" && (
                  <span className="badge bg-sky-500/15 text-sky-300 ml-1">Tự động</span>
                )}
              </td>
              <td className="table-td text-right">
                {t.status === "PENDING" ? (
                  <div className="flex gap-1 justify-end">
                    <button disabled={loading === t.id} onClick={() => act(t.id, "approve")} className="btn btn-primary text-xs">
                      {loading === t.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Duyệt
                    </button>
                    <button disabled={loading === t.id} onClick={() => act(t.id, "reject")} className="btn btn-danger text-xs"><X size={12} /></button>
                  </div>
                ) : (
                  <span className="text-xs text-ink-200/50">{t.processedAt ? formatDateTime(t.processedAt) : "—"}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
