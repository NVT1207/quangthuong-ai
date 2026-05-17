"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatVND, formatDateTime } from "@/lib/format";

type B = {
  id: string;
  gatewayTxId: string;
  gatewayName: string;
  accountNumber: string | null;
  amount: number;
  content: string;
  transferType: string;
  reference: string | null;
  matchedTopupId: string | null;
  transactionDate: string;
  createdAt: string;
  matchedTopup: {
    id: string;
    amount: number;
    reference: string | null;
    userEmail: string;
    userName: string | null;
  } | null;
};

export function BankTxClient({ items }: { items: B[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function matchManual(bankTxId: string) {
    const reference = prompt(
      "Nhập mã reference (vd QT3F2A1B) hoặc email user để gán giao dịch này:",
    );
    if (!reference) return;
    setLoading(bankTxId);
    const r = await fetch(`/api/admin/bank-transactions/${bankTxId}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: reference.trim() }),
    });
    setLoading(null);
    if (r.ok) {
      router.refresh();
    } else {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "Không gán được");
    }
  }

  const unmatched = items.filter((b) => !b.matchedTopupId).length;

  return (
    <div className="space-y-3">
      {unmatched > 0 && (
        <div className="card p-3 flex items-center gap-2 border border-honey-500/30 bg-honey-500/5">
          <AlertCircle size={16} className="text-honey-300" />
          <p className="text-sm text-honey-200">
            Có <span className="font-semibold">{unmatched}</span> giao dịch chưa khớp với yêu cầu nạp.
            Kiểm tra nội dung và gán thủ công nếu cần.
          </p>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Thời gian</th>
              <th className="table-th">Ngân hàng</th>
              <th className="table-th text-right">Số tiền</th>
              <th className="table-th">Nội dung</th>
              <th className="table-th">Mã ref</th>
              <th className="table-th">Khớp</th>
              <th className="table-th text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-td text-center py-12 text-ink-200/50">
                  Chưa có giao dịch nào. Sepay webhook sẽ tự đẩy về đây khi nhận tiền.
                </td>
              </tr>
            ) : (
              items.map((b) => {
                const isExpanded = expandedId === b.id;
                return (
                  <>
                    <tr
                      key={b.id}
                      className="cursor-pointer hover:bg-white/[0.02]"
                      onClick={() => setExpandedId(isExpanded ? null : b.id)}
                    >
                      <td className="table-td text-ink-200/70 text-xs">
                        {formatDateTime(b.transactionDate)}
                      </td>
                      <td className="table-td">
                        <p className="text-sm font-medium">{b.gatewayName}</p>
                        {b.accountNumber && (
                          <p className="text-[10px] text-ink-200/50 font-mono">{b.accountNumber}</p>
                        )}
                      </td>
                      <td className="table-td text-right font-semibold text-emerald-300">
                        +{formatVND(b.amount)}
                      </td>
                      <td className="table-td text-xs text-ink-200/70 max-w-xs truncate">
                        {b.content || "—"}
                      </td>
                      <td className="table-td font-mono text-xs">
                        {b.reference ? (
                          <span className="text-sky-300">{b.reference}</span>
                        ) : (
                          <span className="text-ink-200/40">—</span>
                        )}
                      </td>
                      <td className="table-td">
                        {b.matchedTopup ? (
                          <span className="badge bg-emerald-500/15 text-emerald-300 inline-flex items-center gap-1">
                            <CheckCircle2 size={10} /> Đã khớp
                          </span>
                        ) : (
                          <span className="badge bg-rose-500/15 text-rose-300">Chưa khớp</span>
                        )}
                      </td>
                      <td className="table-td text-right">
                        {!b.matchedTopup && (
                          <button
                            disabled={loading === b.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              matchManual(b.id);
                            }}
                            className="btn btn-ghost text-xs inline-flex items-center gap-1"
                          >
                            {loading === b.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Link2 size={12} />
                            )}
                            Gán
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${b.id}-detail`} className="bg-white/[0.02]">
                        <td colSpan={7} className="px-4 py-3 text-xs space-y-1.5">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                            <div>
                              <span className="text-ink-200/50">Gateway TX ID: </span>
                              <span className="font-mono">{b.gatewayTxId}</span>
                            </div>
                            <div>
                              <span className="text-ink-200/50">Loại: </span>
                              <span>{b.transferType === "in" ? "Nhận tiền" : "Chuyển đi"}</span>
                            </div>
                            <div>
                              <span className="text-ink-200/50">Ghi nhận lúc: </span>
                              <span>{formatDateTime(b.createdAt)}</span>
                            </div>
                            <div>
                              <span className="text-ink-200/50">Số TK: </span>
                              <span className="font-mono">{b.accountNumber || "—"}</span>
                            </div>
                          </div>
                          {b.matchedTopup && (
                            <div className="mt-2 pt-2 border-t border-white/5">
                              <p className="text-ink-200/50 mb-1">Topup đã khớp:</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                <span>
                                  User:{" "}
                                  <span className="text-honey-300">
                                    {b.matchedTopup.userName || b.matchedTopup.userEmail}
                                  </span>
                                </span>
                                <span>
                                  Đăng ký: {formatVND(b.matchedTopup.amount)}
                                </span>
                                <span>
                                  Ref:{" "}
                                  <span className="font-mono text-sky-300">
                                    {b.matchedTopup.reference}
                                  </span>
                                </span>
                              </div>
                            </div>
                          )}
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <p className="text-ink-200/50 mb-1">Nội dung chuyển khoản:</p>
                            <p className="font-mono text-[11px] bg-white/[0.03] px-2 py-1.5 rounded break-all">
                              {b.content || "(trống)"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
