"use client";
import { useState } from "react";
import { Zap, Receipt, ArrowDownRight, ArrowUpRight, Gift } from "lucide-react";
import { formatVND, formatDateTime } from "@/lib/format";

type UsageItem = {
  id: string;
  modelSlug: string;
  cost: number;
  balanceAfter: number | null;
  createdAt: string;
};

type TopupItem = {
  id: string;
  amount: number;
  bonus: number;
  method: string;
  reference: string | null;
  status: string;
  createdAt: string;
  processedAt: string | null;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Đang chờ", cls: "bg-honey-500/15 text-honey-300" },
  APPROVED: { label: "Đã duyệt", cls: "bg-emerald-500/15 text-emerald-300" },
  REJECTED: { label: "Từ chối", cls: "bg-rose-500/15 text-rose-300" },
};

const METHOD_LABEL: Record<string, string> = {
  qr: "QR Vietinbank",
  bank: "Ngân hàng",
  momo: "MoMo",
};

export function HistoryTabs({ usage, topups }: { usage: UsageItem[]; topups: TopupItem[] }) {
  const [tab, setTab] = useState<"usage" | "topup">("usage");
  return (
    <div className="card p-5 lg:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Lịch sử giao dịch</h2>
        <p className="text-sm text-ink-200/60">Xem chi tiết các giao dịch sử dụng API và nạp tiền</p>
      </div>

      <div className="flex p-1 rounded-xl bg-ink-950/60 border border-white/5 mb-4 max-w-md">
        <TabButton active={tab === "usage"} onClick={() => setTab("usage")} icon={<Zap size={13} />} label="Lịch sử sử dụng" />
        <TabButton active={tab === "topup"} onClick={() => setTab("topup")} icon={<Receipt size={13} />} label="Lịch sử nạp" />
      </div>

      {tab === "usage" ? <UsageList items={usage} /> : <TopupList items={topups} />}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
        active ? "bg-honey-500/15 text-honey-200 border border-honey-500/30" : "text-ink-200/60 hover:text-white border border-transparent"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function UsageList({ items }: { items: UsageItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-ink-200/50">
        Chưa có lượt gọi API nào — vào <strong className="text-honey-300">Playground</strong> hoặc tạo API key để bắt đầu.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-white/5">
      {items.map((u) => (
        <li key={u.id} className="flex items-center gap-3 py-3">
          <div className="w-9 h-9 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <Zap size={14} className="text-rose-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Sử dụng API</p>
            <p className="text-xs text-ink-200/50 truncate">API call to {u.modelSlug}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-rose-300 inline-flex items-center gap-1">
              <ArrowDownRight size={11} /> -{formatVND(u.cost)}
            </p>
            {u.balanceAfter != null && (
              <p className="text-[11px] text-ink-200/50">Số dư: {formatVND(u.balanceAfter)}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function TopupList({ items }: { items: TopupItem[] }) {
  if (items.length === 0) {
    return <div className="text-center py-12 text-sm text-ink-200/50">Chưa có yêu cầu nạp tiền nào</div>;
  }
  return (
    <ul className="divide-y divide-white/5">
      {items.map((t) => {
        const status = STATUS_LABEL[t.status] || { label: t.status, cls: "" };
        const credited = t.status === "APPROVED";
        return (
          <li key={t.id} className="flex items-center gap-3 py-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${credited ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-honey-500/10 border border-honey-500/20"}`}>
              <Receipt size={14} className={credited ? "text-emerald-300" : "text-honey-300"} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">Nạp qua {METHOD_LABEL[t.method] || t.method}</p>
                <span className={`badge ${status.cls}`}>{status.label}</span>
                {t.bonus > 0 && (
                  <span className="badge bg-rose-500/15 text-rose-200 text-[10px]">
                    <Gift size={9} /> +{formatVND(t.bonus)}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-200/50">
                {formatDateTime(t.createdAt)}
                {t.reference && <> · Mã: <span className="font-mono text-ink-200/70">{t.reference}</span></>}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-semibold inline-flex items-center gap-1 ${credited ? "text-emerald-300" : "text-honey-300"}`}>
                <ArrowUpRight size={11} /> +{formatVND(t.amount + (credited ? t.bonus : 0))}
              </p>
              {t.processedAt && <p className="text-[11px] text-ink-200/50">Duyệt: {formatDateTime(t.processedAt)}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
