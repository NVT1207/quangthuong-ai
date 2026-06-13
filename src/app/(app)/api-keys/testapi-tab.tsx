"use client";
import { useState } from "react";
import { Send, Loader2, Zap, AlertTriangle, Bot, User as UserIcon } from "lucide-react";
import { formatUSD, formatNumber } from "@/lib/format";
import type { ModelOpt } from "./cli-panels";

type Result =
  | { ok: true; message: string; inputTokens: number; outputTokens: number; cost: number }
  | { ok: false; error: string };

export function TestApiTab({ models }: { models: ModelOpt[] }) {
  const [model, setModel] = useState(models[0]?.slug ?? "");
  const [prompt, setPrompt] = useState("Xin chào! Giới thiệu ngắn gọn về bạn.");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function send() {
    if (!model || !prompt.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setResult({ ok: true, message: j.message ?? "", inputTokens: j.inputTokens ?? 0, outputTokens: j.outputTokens ?? 0, cost: j.cost ?? 0 });
      } else {
        setResult({ ok: false, error: j.error || `Lỗi ${r.status}` });
      }
    } catch (e: any) {
      setResult({ ok: false, error: e?.message || "Lỗi mạng" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-honey-500/20 bg-honey-500/5 px-4 py-3 flex items-start gap-2 text-sm text-ink-100/85">
        <Zap size={14} className="text-honey-300 mt-0.5 shrink-0" />
        <span className="flex-1">
          Gửi thử 1 request tới model để kiểm tra key hoạt động. <b>Mỗi lần gửi sẽ trừ chi phí thật</b> theo token vào số dư của bạn.
        </span>
      </div>

      <div>
        <p className="text-[10px] tracking-wider text-ink-200/55 mb-1.5 font-mono uppercase">MODEL</p>
        <select value={model} onChange={(e) => setModel(e.target.value)} className="input w-full text-sm">
          <option value="">Chọn model...</option>
          {models.map((m) => (
            <option key={m.slug} value={m.slug}>{m.displayName} · {m.provider} · {m.slug}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-[10px] tracking-wider text-ink-200/55 mb-1.5 font-mono uppercase flex items-center gap-1.5">
          <UserIcon size={11} /> PROMPT
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="input w-full text-sm resize-y"
          placeholder="Nhập nội dung gửi cho model..."
        />
      </div>

      <button
        onClick={send}
        disabled={!model || !prompt.trim() || loading}
        className={
          !model || !prompt.trim() || loading
            ? "w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 bg-ink-950/40 text-ink-200/35 border border-white/5 cursor-not-allowed"
            : "w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-violet-400 transition"
        }
      >
        {loading ? <><Loader2 size={14} className="animate-spin" /> Đang gửi...</> : <><Send size={14} /> Gửi thử</>}
      </button>

      {result && result.ok && (
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-ink-950/40 p-4">
            <p className="text-[10px] tracking-wider text-emerald-300/90 font-mono uppercase flex items-center gap-1.5 mb-2">
              <Bot size={12} /> PHẢN HỒI
            </p>
            <p className="text-sm text-ink-100/90 whitespace-pre-wrap break-words">{result.message || "(rỗng)"}</p>
          </div>
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] font-mono text-ink-200/65">
            <span>Input: {formatNumber(result.inputTokens)} tok</span>
            <span className="text-ink-200/30">·</span>
            <span>Output: {formatNumber(result.outputTokens)} tok</span>
            <span className="text-ink-200/30">·</span>
            <span className="text-emerald-300/85">Chi phí: {formatUSD(result.cost)}</span>
          </div>
        </div>
      )}

      {result && !result.ok && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{result.error}</span>
        </div>
      )}
    </div>
  );
}
