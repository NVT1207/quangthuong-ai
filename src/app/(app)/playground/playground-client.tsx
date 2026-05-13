"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, User, Sparkles, Trash2 } from "lucide-react";
import { formatUSD } from "@/lib/format";

type Msg = { role: "user" | "assistant" | "system"; content: string };

export function PlaygroundClient({ models }: { models: { slug: string; name: string; provider: string }[] }) {
  const router = useRouter();
  const [model, setModel] = useState(models[0]?.slug ?? "");
  const [system, setSystem] = useState("Bạn là trợ lý AI hữu ích, trả lời bằng tiếng Việt.");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUsage, setLastUsage] = useState<{ in: number; out: number; cost: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: input };
    const next = [...msgs, userMsg];
    setMsgs(next); setInput(""); setLoading(true);
    try {
      const sysMsgs: Msg[] = system.trim() ? [{ role: "system", content: system }] : [];
      const r = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [...sysMsgs, ...next] }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsgs([...next, { role: "assistant", content: `❌ Lỗi: ${data.error || r.statusText}` }]);
      } else {
        setMsgs([...next, { role: "assistant", content: data.message }]);
        setLastUsage({ in: data.inputTokens, out: data.outputTokens, cost: data.cost });
        router.refresh();
      }
    } catch (err: any) {
      setMsgs([...next, { role: "assistant", content: `❌ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      <div className="space-y-4">
        <div className="card p-4">
          <label className="label">Model</label>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="input">
            {models.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name} ({m.provider})</option>
            ))}
          </select>
          <label className="label mt-4">System prompt</label>
          <textarea value={system} onChange={(e) => setSystem(e.target.value)} rows={6} className="input resize-none" />
        </div>
        {lastUsage && (
          <div className="card p-4 text-sm space-y-1">
            <p className="text-xs text-ink-200/50 mb-2">Lần gọi gần nhất</p>
            <div className="flex justify-between"><span>Input tokens</span><span>{lastUsage.in}</span></div>
            <div className="flex justify-between"><span>Output tokens</span><span>{lastUsage.out}</span></div>
            <div className="flex justify-between font-medium pt-2 border-t border-white/5"><span>Chi phí</span><span className="text-honey-300">{formatUSD(lastUsage.cost)}</span></div>
          </div>
        )}
      </div>

      <div className="card flex flex-col h-[70vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <p className="text-sm font-medium">Hội thoại</p>
          {msgs.length > 0 && (
            <button onClick={() => { setMsgs([]); setLastUsage(null); }} className="btn btn-ghost text-xs"><Trash2 size={12} /> Xóa</button>
          )}
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {msgs.length === 0 && (
            <div className="text-center py-12 text-ink-200/40">
              <Sparkles className="mx-auto mb-3" size={32} />
              <p className="text-sm">Bắt đầu hội thoại với {models.find((m) => m.slug === model)?.name}</p>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role !== "user" && <div className="w-8 h-8 rounded-full bg-honey-500/15 border border-honey-500/30 flex items-center justify-center shrink-0"><Sparkles size={14} className="text-honey-400" /></div>}
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-honey-500/15 border border-honey-500/30" : "bg-white/5 border border-white/5"}`}>{m.content}</div>
              {m.role === "user" && <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0"><User size={14} /></div>}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-honey-500/15 border border-honey-500/30 flex items-center justify-center"><Loader2 size={14} className="animate-spin text-honey-400" /></div>
              <div className="bg-white/5 rounded-2xl px-4 py-2.5 text-sm text-ink-200/50">Đang trả lời...</div>
            </div>
          )}
        </div>
        <form onSubmit={send} className="flex gap-2 p-4 border-t border-white/5">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Nhập tin nhắn..." className="input flex-1" disabled={loading} />
          <button disabled={loading || !input.trim()} className="btn btn-primary"><Send size={14} /></button>
        </form>
      </div>
    </div>
  );
}
