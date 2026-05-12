import { formatVND } from "@/lib/format";
import { Wallet } from "lucide-react";
import Link from "next/link";

export function Topbar({ name, balance, role }: { name: string; balance: number; role: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 py-3 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
      <div>
        <p className="text-xs text-ink-200/50">Xin chào</p>
        <p className="text-sm font-medium">{name}{role === "ADMIN" && <span className="ml-2 badge bg-honey-500/15 text-honey-300">ADMIN</span>}</p>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/topup" className="flex items-center gap-2 rounded-xl bg-honey-500/10 border border-honey-500/20 px-3 py-1.5 text-sm hover:bg-honey-500/20 transition">
          <Wallet size={14} className="text-honey-400" />
          <span className="text-honey-300 font-semibold">{formatVND(balance)}</span>
          <span className="text-ink-200/60 text-xs">+ Nạp</span>
        </Link>
      </div>
    </header>
  );
}
