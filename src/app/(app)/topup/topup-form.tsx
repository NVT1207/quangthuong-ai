"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, QrCode, CreditCard, Apple, Tag, Gift, Copy, Check, X, Banknote } from "lucide-react";
import { formatVND } from "@/lib/format";
import { PRESET_AMOUNTS, PROMO_CODES } from "@/lib/topup";

type TopupResult = {
  id: string;
  reference: string;
  qrUrl: string;
  bonus: number;
  bank: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
};

const METHODS = [
  { key: "qr", label: "QR Code", icon: QrCode, enabled: true },
  { key: "visa", label: "Visa Card", icon: CreditCard, enabled: false },
  { key: "paypal", label: "PayPal", icon: () => <span className="font-bold text-base">𝑃</span>, enabled: false },
  { key: "applepay", label: "Apple Pay", icon: Apple, enabled: false },
  { key: "googlepay", label: "Google Pay", icon: () => <span className="font-bold text-base">G</span>, enabled: false },
];

export function TopupForm() {
  const router = useRouter();
  const [amount, setAmount] = useState<number>(0);
  const [amountStr, setAmountStr] = useState("");
  const [promo, setPromo] = useState("");
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [method, setMethod] = useState("qr");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TopupResult | null>(null);

  function selectPreset(v: number) {
    setAmount(v);
    setAmountStr(v.toLocaleString("vi-VN"));
    setError("");
  }

  function onAmountChange(v: string) {
    const digits = v.replace(/\D/g, "");
    const n = parseInt(digits) || 0;
    setAmount(n);
    setAmountStr(n ? n.toLocaleString("vi-VN") : "");
    setError("");
  }

  function applyPromo() {
    const code = promo.trim().toUpperCase();
    if (!code) return;
    if (PROMO_CODES.includes(code)) {
      setPromoApplied(code);
      setError("");
    } else {
      setPromoApplied(null);
      setError("Mã khuyến mãi không hợp lệ");
    }
  }

  async function submit() {
    if (amount < 20000) {
      setError("Số tiền tối thiểu 20.000₫");
      return;
    }
    setLoading(true);
    setError("");
    const r = await fetch("/api/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method, promoCode: promoApplied || undefined }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) {
      setError(data.error || "Có lỗi xảy ra");
      return;
    }
    setResult(data);
    router.refresh();
  }

  function closeModal() {
    setResult(null);
    setAmount(0);
    setAmountStr("");
    setPromo("");
    setPromoApplied(null);
  }

  return (
    <>
      <div className="card p-5 lg:p-6">
        <h2 className="text-lg font-semibold mb-1">Nạp tiền</h2>
        <p className="text-sm text-ink-200/60 mb-5">Chọn số tiền và phương thức thanh toán</p>

        <div className="mb-5">
          <p className="text-sm font-medium text-ink-200/80 mb-2.5">Chọn mệnh giá</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {PRESET_AMOUNTS.map((p) => {
              const active = amount === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => selectPreset(p.value)}
                  className={`relative rounded-xl border px-3 py-3.5 text-sm font-semibold transition ${
                    active
                      ? "bg-honey-500/15 border-honey-500/60 text-honey-200 shadow-glow"
                      : "bg-ink-950/60 border-white/10 text-white hover:border-honey-500/40 hover:bg-honey-500/5"
                  }`}
                >
                  {p.bonus > 0 && (
                    <span className="absolute -top-2 right-1.5 inline-flex items-center gap-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 shadow">
                      <Gift size={9} /> Tặng {p.bonus.toLocaleString("vi-VN")}₫
                    </span>
                  )}
                  {p.value.toLocaleString("vi-VN")}₫
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-5">
          <p className="text-sm font-medium text-ink-200/80 mb-2.5">Phương thức thanh toán</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {METHODS.map((m) => {
              const active = method === m.key && m.enabled;
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  disabled={!m.enabled}
                  onClick={() => m.enabled && setMethod(m.key)}
                  className={`relative rounded-xl border px-3 py-2.5 text-xs font-medium transition flex items-center gap-1.5 justify-center ${
                    active
                      ? "bg-honey-500/15 border-honey-500/60 text-honey-200"
                      : m.enabled
                        ? "bg-ink-950/60 border-white/10 text-white hover:border-honey-500/40"
                        : "bg-ink-950/30 border-white/5 text-ink-200/40 cursor-not-allowed"
                  }`}
                >
                  {!m.enabled && (
                    <span className="absolute -top-1.5 right-1 rounded-full bg-ink-700 text-ink-200/80 text-[8px] font-semibold px-1.5 py-0.5 border border-white/10">
                      Coming soon
                    </span>
                  )}
                  <Icon size={14} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="label">Số tiền nạp</label>
            <div className="relative">
              <input
                inputMode="numeric"
                value={amountStr}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="Nhập số tiền (tối thiểu 20.000₫)"
                className="input pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-200/40">₫</span>
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-1">
              <Tag size={11} /> Mã khuyến mãi
            </label>
            <div className="flex gap-2">
              <input
                value={promo}
                onChange={(e) => {
                  setPromo(e.target.value.toUpperCase());
                  setPromoApplied(null);
                }}
                placeholder="NHẬP MÃ..."
                className="input flex-1 uppercase tracking-wider"
                maxLength={20}
              />
              <button
                type="button"
                onClick={applyPromo}
                disabled={!promo.trim()}
                className="btn btn-ghost text-xs px-3 shrink-0"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>

        {promoApplied && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
            <Check size={12} /> Đã áp dụng mã <strong className="font-mono tracking-widest">{promoApplied}</strong>
          </div>
        )}

        {error && <p className="text-sm text-rose-400 mb-3">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={loading || amount < 20000}
          className="btn btn-primary w-full py-3 text-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
          Tạo mã thanh toán
        </button>
      </div>

      {result && <QrModal result={result} amount={amount} onClose={closeModal} />}
    </>
  );
}

function QrModal({ result, amount, onClose }: { result: TopupResult; amount: number; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }
  const total = amount + result.bonus;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-2xl bg-ink-900 border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-honey-300" />
            <h3 className="font-semibold">Mã thanh toán</h3>
          </div>
          <button onClick={onClose} className="text-ink-200/60 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-white p-3 mx-auto w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.qrUrl} alt="QR thanh toán" className="w-60 h-60 object-contain" />
          </div>

          <div className="text-center">
            <p className="text-xs text-ink-200/50 mb-0.5">Số tiền chuyển</p>
            <p className="text-2xl font-bold text-honey-300">{formatVND(amount)}</p>
            {result.bonus > 0 && (
              <p className="text-xs text-emerald-300 mt-1 flex items-center justify-center gap-1">
                <Gift size={11} /> Được tặng thêm {formatVND(result.bonus)} sau khi duyệt → tổng {formatVND(total)}
              </p>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <BankRow label="Ngân hàng" value={result.bank.bankName} icon={<Banknote size={12} />} />
            <BankRow label="Số tài khoản" value={result.bank.accountNumber} copyKey="acc" copied={copied} onCopy={copy} />
            <BankRow label="Chủ tài khoản" value={result.bank.accountName} />
            <BankRow
              label="Nội dung CK"
              value={result.reference}
              highlight
              copyKey="ref"
              copied={copied}
              onCopy={copy}
            />
          </div>

          <div className="rounded-xl bg-honey-500/10 border border-honey-500/20 px-3 py-2.5 text-xs text-honey-200/90 leading-relaxed">
            <strong>⚠️ Quan trọng:</strong> Phải ghi đúng nội dung <strong className="font-mono">{result.reference}</strong> khi chuyển khoản. Sau 1–5 phút admin sẽ xác nhận và cộng tiền tự động.
          </div>

          <button onClick={onClose} className="btn btn-ghost w-full">
            Đã chuyển khoản, đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function BankRow({
  label,
  value,
  highlight,
  copyKey,
  copied,
  onCopy,
  icon,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  copyKey?: string;
  copied?: string | null;
  onCopy?: (v: string, k: string) => void;
  icon?: React.ReactNode;
}) {
  const isCopied = copyKey && copied === copyKey;
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-ink-200/60 text-xs flex items-center gap-1">
        {icon}
        {label}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <p className={`font-mono text-sm truncate ${highlight ? "text-honey-300 font-bold tracking-wider" : ""}`}>
          {value}
        </p>
        {copyKey && onCopy && (
          <button
            onClick={() => onCopy(value, copyKey)}
            className="text-ink-200/40 hover:text-honey-300 transition shrink-0"
            title="Copy"
          >
            {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}
