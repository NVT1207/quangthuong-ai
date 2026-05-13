import { formatVND } from "@/lib/format";
import { Wallet, Zap } from "lucide-react";
import Link from "next/link";

const TIER_STYLE: Record<string, string> = {
  FREE: "bg-white/5 border-white/10 text-ink-200/80 hover:border-honey-500/30 hover:text-honey-200",
  BASIC: "bg-sky-500/10 border-sky-500/20 text-sky-300",
  ADV: "bg-honey-500/10 border-honey-500/20 text-honey-300",
  ULTRA: "bg-gradient-to-r from-violet-500/20 to-rose-500/20 border-violet-500/30 text-violet-200",
};

const TIER_LABEL: Record<string, string> = {
  FREE: "Nâng cấp",
  BASIC: "Basic",
  ADV: "Advanced+",
  ULTRA: "Ultra",
};

export function Topbar({
  name,
  balance,
  role,
  tier = "FREE",
}: {
  name: string;
  balance: number;
  role: string;
  tier?: string;
}) {
  const tierStyle = TIER_STYLE[tier] ?? TIER_STYLE.FREE;
  const tierLabel = TIER_LABEL[tier] ?? "Nâng cấp";
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 py-3 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
      <div>
        <p className="text-xs text-ink-200/50">Xin chào</p>
        <p className="text-sm font-medium">
          {name}
          {role === "ADMIN" && (
            <span className="ml-2 badge bg-honey-500/15 text-honey-300">ADMIN</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/nang-cap"
          className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition hover:brightness-110 ${tierStyle}`}
          title={tier === "FREE" ? "Nâng cấp gói để giảm giá model" : `Plan: ${tierLabel}`}
        >
          <Zap size={14} />
          <span className="font-semibold">{tierLabel}</span>
          {tier !== "FREE" && <span className="text-[10px] opacity-60">↑</span>}
        </Link>
        <Link
          href="/topup"
          className="flex items-center gap-2 rounded-xl bg-honey-500/10 border border-honey-500/20 px-3 py-1.5 text-sm hover:bg-honey-500/20 transition"
        >
          <Wallet size={14} className="text-honey-400" />
          <span className="text-honey-300 font-semibold">{formatVND(balance)}</span>
          <span className="text-ink-200/60 text-xs">+ Nạp</span>
        </Link>
      </div>
    </header>
  );
}
