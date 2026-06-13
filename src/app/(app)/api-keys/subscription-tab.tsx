"use client";
import { useEffect, useState } from "react";
import { Loader2, Zap, Crown, Check, ArrowRight, Sparkles } from "lucide-react";
import { formatVND } from "@/lib/format";
import {
  PLAN_PRICES,
  PERIOD_DAYS,
  PERIOD_LABEL,
  PERIOD_DISCOUNT_LABEL as PERIOD_DISCOUNT,
  TIER_LABEL,
  TIER_RANK,
  type Period,
  type PaidPlan,
  type Tier,
} from "@/lib/tier-config";

type SubState = {
  balance: number;
  tier: Tier;
  tierSource: "AUTO" | "PAID";
  autoTier: Tier;
  tierExpiresAt: string | null;
  topup30d: number;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const PLAN_META: Record<PaidPlan, { name: string; icon: typeof Zap; color: string; border: string; bg: string; perks: string[] }> = {
  BASIC: {
    name: "Basic", icon: Zap, color: "text-sky-300", border: "border-sky-500/30", bg: "bg-sky-500/10",
    perks: ["100+ model", "Giảm giá >30%", "1.000 RPM", "Prompt Caching + Fallback"],
  },
  ADV: {
    name: "Advanced+", icon: Crown, color: "text-honey-300", border: "border-honey-500/30", bg: "bg-honey-500/10",
    perks: ["100+ model", "Giảm giá >50%", "2.000 RPM", "Management API"],
  },
};

export function SubscriptionTab() {
  const [state, setState] = useState<SubState | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("MONTH");
  const [buying, setBuying] = useState<PaidPlan | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/subscriptions")
      .then((r) => r.json())
      .then((d) => setState(d))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function buy(plan: PaidPlan) {
    if (!state) return;
    const amount = PLAN_PRICES[plan][period];
    const ok = window.confirm(
      `Trừ ${formatVND(amount)} từ số dư (${formatVND(state.balance)} → ${formatVND(state.balance - amount)}).\n\nGói ${PLAN_META[plan].name} — ${PERIOD_LABEL[period]}.\n\nTiếp tục?`,
    );
    if (!ok) return;
    setBuying(plan);
    setErr(null);
    try {
      const r = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, period }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "Lỗi không xác định"); return; }
      load();
    } catch (e: any) {
      setErr(e?.message || "Lỗi mạng");
    } finally {
      setBuying(null);
    }
  }

  if (loading || !state) {
    return <div className="py-12 text-center text-ink-200/50 text-sm flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Đang tải gói...</div>;
  }

  const currentTier = state.tier;

  return (
    <div className="space-y-5">
      {/* Current status */}
      <div className="rounded-xl border border-white/5 bg-ink-950/40 px-4 py-3 flex flex-wrap items-center gap-2 text-sm">
        <Sparkles size={15} className="text-honey-300" />
        <span className="text-ink-200/60">Gói hiện tại:</span>
        <span className="text-[12px] font-semibold px-2 py-0.5 rounded border border-honey-500/30 bg-honey-500/10 text-honey-300">
          {TIER_LABEL[currentTier]}
        </span>
        <span className="text-[11px] text-ink-200/55">
          {state.tierSource === "PAID" ? `· trả phí · hết hạn ${fmtDate(state.tierExpiresAt)}` : `· auto · nạp ${formatVND(state.topup30d)}/30 ngày`}
        </span>
        <span className="text-ink-200/30">·</span>
        <span className="text-ink-200/60">Số dư:</span>
        <span className="text-honey-300 font-semibold">{formatVND(state.balance)}</span>
        <a href="/topup" className="ml-auto text-xs text-honey-300 hover:underline">Nạp thêm →</a>
      </div>

      {/* Period selector */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
        {(["MONTH", "HALF_YEAR", "YEAR"] as Period[]).map((p) => {
          const active = period === p;
          return (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 ${active ? "bg-honey-500 text-ink-950 font-bold shadow" : "text-ink-200/70 hover:text-white"}`}
            >
              {PERIOD_LABEL[p]}
              {PERIOD_DISCOUNT[p] && <span className={`text-[10px] font-bold ${active ? "text-ink-950" : "text-emerald-400"}`}>{PERIOD_DISCOUNT[p]}</span>}
            </button>
          );
        })}
      </div>

      {err && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {err}
          {err.toLowerCase().includes("số dư") && <> <a href="/topup" className="underline font-semibold">Nạp ngay →</a></>}
        </div>
      )}

      {/* Plan cards */}
      <div className="grid sm:grid-cols-2 gap-3">
        {(["BASIC", "ADV"] as PaidPlan[]).map((plan) => {
          const meta = PLAN_META[plan];
          const Icon = meta.icon;
          const planRank = TIER_RANK[plan];
          const currRank = TIER_RANK[currentTier];
          const isCurrent = currentTier === plan;
          const isSelfPaid = isCurrent && state.tierSource === "PAID";
          const higher = currRank > planRank;
          const loadingThis = buying === plan;
          return (
            <div key={plan} className={`relative rounded-2xl border-2 ${meta.border} ${meta.bg} p-5 flex flex-col gap-3 ${isCurrent ? "ring-2 ring-emerald-400/40" : ""}`}>
              {isCurrent && <span className="absolute -top-3 right-4 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500 text-white">ĐANG DÙNG</span>}
              <div className={`inline-flex w-9 h-9 rounded-xl items-center justify-center ${meta.bg} border ${meta.border}`}>
                <Icon size={18} className={meta.color} />
              </div>
              <div>
                <h3 className={`text-base font-bold ${meta.color}`}>{meta.name}</h3>
                <div className="mt-1">
                  <span className="text-xl font-bold text-white">{formatVND(PLAN_PRICES[plan][period])}</span>
                  <span className="text-ink-200/50 text-xs ml-1">/ {PERIOD_LABEL[period]}</span>
                </div>
              </div>
              <ul className="space-y-1 text-xs flex-1">
                {meta.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-1.5 text-ink-200/80">
                    <Check size={12} className="mt-0.5 text-emerald-400 shrink-0" /> <span>{perk}</span>
                  </li>
                ))}
              </ul>
              {higher ? (
                <button disabled className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-ink-200/50 cursor-not-allowed">
                  Đang dùng gói cao hơn
                </button>
              ) : (
                <button
                  onClick={() => buy(plan)}
                  disabled={loadingThis}
                  className={`w-full rounded-xl px-4 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 ${plan === "ADV" ? "bg-honey-500 text-ink-950 hover:bg-honey-400" : "bg-sky-500 text-white hover:bg-sky-400"}`}
                >
                  {loadingThis ? <Loader2 size={13} className="animate-spin" /> : <>{isSelfPaid ? "Gia hạn" : "Nâng cấp"} <ArrowRight size={13} /></>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-ink-200/50">
        Thanh toán bằng số dư tài khoản. Gia hạn cùng gói sẽ cộng dồn thời hạn; nâng gói cao hơn bắt đầu chu kỳ mới. Xem chi tiết tại <a href="/nang-cap" className="text-sky-300 hover:underline">trang Nâng cấp</a>.
      </p>
    </div>
  );
}
