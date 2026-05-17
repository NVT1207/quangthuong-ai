"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  X,
  Zap,
  Sparkles,
  Crown,
  Gem,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { formatVND } from "@/lib/format";
import {
  PLAN_PRICES,
  PERIOD_DAYS,
  PERIOD_LABEL,
  PERIOD_DISCOUNT_LABEL as PERIOD_DISCOUNT,
  TIER_RANK,
  type Period,
  type PaidPlan,
  type Tier,
} from "@/lib/tier-config";

type FeatureRow = {
  label: string;
  values: [string | boolean, string | boolean, string | boolean, string | boolean];
};

const FEATURES: FeatureRow[] = [
  { label: "Số lượng model", values: ["2+ free", "100+", "100+", "100+"] },
  { label: "Ưu đãi giá model", values: ["—", "Giảm >30%", "Giảm >50%", "Giảm tối đa"] },
  { label: "RPM (requests/phút)", values: ["500", "1.000", "2.000", "5.000"] },
  { label: "Dedicated API Lane", values: [false, false, false, true] },
  { label: "Model Fallback", values: [false, true, true, true] },
  { label: "Prompt Caching", values: [false, true, true, true] },
  { label: "Export Excel", values: [false, true, true, true] },
  { label: "Management API", values: [false, false, true, true] },
  { label: "Tính năng nâng cao", values: [false, false, true, true] },
  { label: "Lưu trữ Usage", values: ["30 ngày", "365 ngày", "365 ngày", "Vĩnh viễn"] },
  { label: "Slots Email BeeSynapse", values: ["5", "10", "20", "∞"] },
  { label: "Quota BeeSynapse", values: ["10/ngày", "50/ngày", "200/ngày", "∞"] },
  { label: "Hỗ trợ", values: ["Cộng đồng", "Email", "Email ưu tiên", "Hotline 24/7"] },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function UpgradeClient({
  balance,
  tier,
  tierSource,
  tierExpiresAt,
  autoTier,
  topup30d,
}: {
  balance: number;
  tier: string;
  tierSource: string;
  tierExpiresAt: string | null;
  autoTier: string;
  topup30d: number;
}) {
  const [period, setPeriod] = useState<Period>("MONTH");
  const [loading, setLoading] = useState<PaidPlan | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const currentTier = tier as Tier;
  const ultraProgress = Math.min(100, (topup30d / 10_000_000) * 100);

  const onBuy = async (plan: PaidPlan) => {
    const amount = PLAN_PRICES[plan][period];
    const ok = window.confirm(
      `Trừ ${formatVND(amount)} từ số dư (${formatVND(balance)} → ${formatVND(
        balance - amount
      )}).\n\nGói ${plan === "BASIC" ? "Basic" : "Advanced+"} — ${PERIOD_LABEL[period]}.\nHết hạn: ${formatDate(
        new Date(Date.now() + PERIOD_DAYS[period] * 86_400_000).toISOString()
      )}.\n\nTiếp tục?`
    );
    if (!ok) return;
    setLoading(plan);
    setErr(null);
    try {
      const r = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, period }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Lỗi không xác định");
        setLoading(null);
        return;
      }
      window.location.reload();
    } catch (e: any) {
      setErr(e?.message || "Lỗi mạng");
      setLoading(null);
    }
  };

  const plans = useMemo(
    () => [
      {
        key: "FREE" as const,
        name: "Free",
        icon: Sparkles,
        color: "text-ink-200/80",
        border: "border-white/10",
        bg: "bg-white/5",
        price: "0₫",
        priceNote: "Mãi mãi",
        perks: [
          "Dùng 2+ model miễn phí",
          "500 RPM",
          "Usage lưu 30 ngày",
          "Hỗ trợ cộng đồng",
        ],
        autoNote: null,
      },
      {
        key: "BASIC" as const,
        name: "Basic",
        icon: Zap,
        color: "text-sky-300",
        border: "border-sky-500/30",
        bg: "bg-sky-500/10",
        price: formatVND(PLAN_PRICES.BASIC[period]),
        priceNote: PERIOD_LABEL[period],
        perks: [
          "100+ model",
          "Giảm giá >30%",
          "1.000 RPM",
          "Prompt Caching, Model Fallback",
          "Export Excel",
        ],
        autoNote: "Hoặc tự động khi nạp ≥ 2.000.000₫ / 30 ngày",
      },
      {
        key: "ADV" as const,
        name: "Advanced+",
        icon: Crown,
        color: "text-honey-300",
        border: "border-honey-500/30",
        bg: "bg-honey-500/10",
        price: formatVND(PLAN_PRICES.ADV[period]),
        priceNote: PERIOD_LABEL[period],
        perks: [
          "100+ model",
          "Giảm giá >50%",
          "2.000 RPM",
          "Management API",
          "Tính năng nâng cao",
          "Email ưu tiên",
        ],
        autoNote: "Hoặc tự động khi nạp ≥ 5.000.000₫ / 30 ngày",
        highlight: true,
      },
      {
        key: "ULTRA" as const,
        name: "Ultra",
        icon: Gem,
        color: "text-violet-200",
        border: "border-violet-500/30",
        bg: "bg-gradient-to-br from-violet-500/10 to-rose-500/10",
        price: "Tự động",
        priceNote: "Không bán riêng",
        perks: [
          "Tất cả quyền lợi Advanced+",
          "5.000 RPM",
          "Dedicated API Lane",
          "Lưu usage vĩnh viễn",
          "Hotline 24/7",
        ],
        autoNote: "Kích hoạt khi nạp ≥ 10.000.000₫ / 30 ngày",
      },
    ],
    [period]
  );

  const renderButton = (planKey: "FREE" | PaidPlan | "ULTRA") => {
    if (planKey === "FREE") {
      return (
        <button
          disabled
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-ink-200/50 cursor-not-allowed"
        >
          {currentTier === "FREE" ? "Plan hiện tại" : "—"}
        </button>
      );
    }
    if (planKey === "ULTRA") {
      return (
        <div className="space-y-2">
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-400 to-rose-400 transition-all"
              style={{ width: `${ultraProgress}%` }}
            />
          </div>
          <p className="text-center text-xs text-ink-200/60">
            {formatVND(topup30d)} / {formatVND(10_000_000)} ({ultraProgress.toFixed(0)}%)
          </p>
        </div>
      );
    }
    const isPaid = planKey === "BASIC" || planKey === "ADV";
    if (!isPaid) return null;
    const planRank = TIER_RANK[planKey as Tier];
    const currRank = TIER_RANK[currentTier];

    if (currRank > planRank) {
      return (
        <button
          disabled
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-ink-200/50 cursor-not-allowed"
        >
          Đang dùng gói cao hơn
        </button>
      );
    }

    const isSelfPaid = currentTier === planKey && tierSource === "PAID";
    const isSelfAuto = currentTier === planKey && tierSource === "AUTO";
    const loadingThis = loading === planKey;

    const btnClass =
      planKey === "ADV"
        ? "bg-honey-500 text-ink-950 hover:bg-honey-400"
        : "bg-sky-500 text-white hover:bg-sky-400";

    return (
      <div className="space-y-2">
        {isSelfPaid && tierExpiresAt && (
          <p className="text-center text-[11px] text-ink-200/60">
            Hết hạn {formatDate(tierExpiresAt)}
          </p>
        )}
        {isSelfAuto && (
          <p className="text-center text-[11px] text-emerald-300">
            Đang miễn phí (theo ngưỡng nạp)
          </p>
        )}
        <button
          onClick={() => onBuy(planKey)}
          disabled={loadingThis}
          className={`w-full rounded-xl px-4 py-2.5 text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 ${btnClass}`}
        >
          {loadingThis ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <>
              {isSelfPaid ? "Gia hạn" : isSelfAuto ? "Mua để giữ ổn định" : "Nâng cấp ngay"}
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Các gói dịch vụ nâng cao</h1>
        <p className="text-ink-200/60 mt-2">
          Giảm giá trực tiếp trên mọi model khi bạn nâng cấp. Thanh toán bằng chính số dư tài khoản.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-ink-200/60">Plan hiện tại:</span>
          <span className="badge bg-honey-500/10 text-honey-300 border border-honey-500/20">
            {currentTier}{" "}
            {tierSource === "PAID"
              ? `· PAID · hết hạn ${formatDate(tierExpiresAt)}`
              : `· AUTO · nạp ${formatVND(topup30d)} / 30 ngày`}
          </span>
          <span className="text-ink-200/60">· Số dư:</span>
          <span className="text-honey-300 font-semibold">{formatVND(balance)}</span>
          <Link
            href="/topup"
            className="ml-auto text-xs text-honey-300 hover:text-honey-200 underline"
          >
            Nạp thêm →
          </Link>
        </div>
      </div>

      {/* Period selector */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
        {(["MONTH", "HALF_YEAR", "YEAR"] as Period[]).map((p) => {
          const active = period === p;
          return (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-sm transition flex items-center gap-2 ${
                active
                  ? "bg-honey-500 text-ink-950 font-bold shadow"
                  : "text-ink-200/70 hover:text-white"
              }`}
            >
              {PERIOD_LABEL[p]}
              {PERIOD_DISCOUNT[p] && (
                <span
                  className={`text-[10px] font-bold ${
                    active ? "text-ink-950" : "text-emerald-400"
                  }`}
                >
                  {PERIOD_DISCOUNT[p]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {err && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {err}
          {err.toLowerCase().includes("số dư") && (
            <>
              {" "}
              <Link href="/topup" className="underline font-semibold">
                Nạp ngay →
              </Link>
            </>
          )}
        </div>
      )}

      {/* 4 plan cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => {
          const Icon = p.icon;
          const isCurrent = currentTier === p.key;
          return (
            <div
              key={p.key}
              className={`relative rounded-2xl border-2 ${p.border} ${p.bg} p-6 flex flex-col gap-4 ${
                (p as any).highlight ? "ring-2 ring-honey-400/30 shadow-xl shadow-honey-500/10" : ""
              } ${isCurrent ? "ring-2 ring-emerald-400/40" : ""}`}
            >
              {(p as any).highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge bg-honey-500 text-ink-950 font-bold text-[10px]">
                  PHỔ BIẾN NHẤT
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 right-4 badge bg-emerald-500 text-white font-bold text-[10px]">
                  ĐANG DÙNG
                </span>
              )}
              <div className={`inline-flex w-10 h-10 rounded-xl items-center justify-center ${p.bg} border ${p.border}`}>
                <Icon size={20} className={p.color} />
              </div>
              <div>
                <h3 className={`text-lg font-bold ${p.color}`}>{p.name}</h3>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-white">{p.price}</span>
                  <span className="text-ink-200/50 text-sm ml-1">/ {p.priceNote}</span>
                </div>
              </div>
              <ul className="space-y-1.5 text-sm flex-1">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-ink-200/80">
                    <Check size={14} className="mt-0.5 text-emerald-400 shrink-0" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
              {p.autoNote && (
                <p className="text-[11px] text-ink-200/50 leading-relaxed">{p.autoNote}</p>
              )}
              {renderButton(p.key)}
            </div>
          );
        })}
      </div>

      {/* Feature comparison table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="font-bold text-lg">So sánh chi tiết</h2>
          <p className="text-xs text-ink-200/50 mt-1">Tất cả tính năng — duyệt ngang để xem đầy đủ</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="text-left px-6 py-3 font-medium text-ink-200/60 sticky left-0 bg-ink-950/80 backdrop-blur">
                  Tính năng
                </th>
                <th className="px-4 py-3 font-bold">Free</th>
                <th className="px-4 py-3 font-bold text-sky-300">Basic</th>
                <th className="px-4 py-3 font-bold text-honey-300">Advanced+</th>
                <th className="px-4 py-3 font-bold text-violet-200">Ultra</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((row, i) => (
                <tr
                  key={row.label}
                  className={`border-b border-white/5 ${i % 2 === 1 ? "bg-white/[0.015]" : ""}`}
                >
                  <td className="px-6 py-3 text-ink-200/80 sticky left-0 bg-ink-950/80 backdrop-blur">
                    {row.label}
                  </td>
                  {row.values.map((v, j) => (
                    <td key={j} className="px-4 py-3 text-center">
                      {typeof v === "boolean" ? (
                        v ? (
                          <Check size={16} className="inline text-emerald-400" />
                        ) : (
                          <X size={16} className="inline text-ink-200/30" />
                        )
                      ) : (
                        <span className="text-ink-200/80">{v}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-ink-200/50">
        Gói nâng cấp trả phí có thể gia hạn trước khi hết hạn để cộng dồn. Nâng lên gói cao hơn sẽ hủy
        gói cũ và bắt đầu chu kỳ mới. Không hỗ trợ downgrade khi còn hạn.
      </p>
    </div>
  );
}
