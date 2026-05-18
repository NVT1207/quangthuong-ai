"use client";
import { useEffect, useState } from "react";
import {
  X, Link2, Combine, Rocket, Settings2, Zap, History, Sparkles, Bot, Terminal as TerminalIcon,
  Plus, BarChart3, Plug,
} from "lucide-react";
import { formatUSD, formatNumber, formatDateTime } from "@/lib/format";
import { ClaudeSetupCard, OpenclawSetupCard, type KeyItem, type ModelOpt } from "./cli-panels";
import { ModelsTab } from "./models-tab";
import { ThirdPartySetupCard } from "./third-party-setup";

type Detail = {
  key: { id: string; name: string; prefix: string; suffix: string; enabled: boolean; createdAt: string; lastUsedAt: string | null };
  stats: { totalRequests: number; totalCost: number; totalInputTokens: number; totalOutputTokens: number };
  chart: { date: string; cost: number; count: number }[];
  topModels: { slug: string; displayName: string; count: number; cost: number }[];
  recent: { id: string; modelSlug: string; modelName: string; inputTokens: number; outputTokens: number; cost: number; status: number; createdAt: string }[];
};

type Props = {
  keyId: string;
  onClose: () => void;
  baseUrl: string;
  models: ModelOpt[];
  keyItem: KeyItem;
  revealed?: Record<string, string>;
};

type TabKey = "models" | "stats" | "history" | "claude" | "openclaw" | "thirdparty";

export function KeyDetailModal({ keyId, onClose, baseUrl, models, keyItem, revealed }: Props) {
  const [tab, setTab] = useState<TabKey>("models");
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelCount, setModelCount] = useState<number | null>(null);
  const [addModelTick, setAddModelTick] = useState(0); // signal ModelsTab mở picker

  useEffect(() => {
    setLoading(true);
    fetch(`/api/keys/${keyId}/detail`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [keyId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const maxCost = data ? Math.max(...data.chart.map((c) => c.cost), 1) : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[95vh] flex flex-col rounded-2xl bg-ink-900 border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ──────── Header ──────── */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-white/5 bg-ink-900/95 backdrop-blur shrink-0">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-ink-200/60 hover:text-white transition shrink-0 mt-0.5"
          >
            <X size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold truncate flex items-center gap-2">
              <Link2 size={18} className="text-sky-300 shrink-0" />
              {data?.key.name ?? keyItem.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={
                (data?.key.enabled ?? true)
                  ? "text-[11px] font-medium px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "text-[11px] font-medium px-2 py-0.5 rounded border border-ink-500/30 bg-ink-500/10 text-ink-200/60"
              }>
                {(data?.key.enabled ?? true) ? "Active" : "Tắt"}
              </span>
              <span className="text-xs font-mono text-ink-200/55">·</span>
              <code className="text-xs font-mono text-ink-200/70">{keyItem.prefix}...{keyItem.suffix}</code>
            </div>
          </div>
          {tab === "models" && (
            <button
              onClick={() => setAddModelTick((t) => t + 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-md shadow-sky-500/20 hover:from-sky-400 hover:to-violet-400 transition shrink-0"
            >
              <Plus size={14} /> Thêm Model mới
            </button>
          )}
        </div>

        {/* ──────── Tab bar ──────── */}
        <div className="px-4 py-3 border-b border-white/5 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            <TabPill active={tab === "models"} onClick={() => setTab("models")} icon={<Link2 size={13} />}>
              Models{modelCount !== null && ` (${modelCount})`}
            </TabPill>
            <TabPill active={tab === "stats"} onClick={() => setTab("stats")} icon={<BarChart3 size={13} />}>
              Thống kê
            </TabPill>
            <TabPill active={tab === "history"} onClick={() => setTab("history")} icon={<History size={13} />}>
              Lịch sử
            </TabPill>
            <TabPill active={tab === "claude"} onClick={() => setTab("claude")} icon={<Sparkles size={13} className="text-orange-300" />}>
              Claude Code
            </TabPill>
            <TabPill active={tab === "openclaw"} onClick={() => setTab("openclaw")} icon={<Bot size={13} className="text-rose-300" />}>
              OpenClaw
            </TabPill>
            <TabPill active={tab === "thirdparty"} onClick={() => setTab("thirdparty")} icon={<Plug size={13} className="text-sky-300" />}>
              Kết nối khác
            </TabPill>
          </div>
        </div>

        {/* ──────── Body ──────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {tab === "models" && (
            <ModelsTab
              keyId={keyId}
              onCountChange={setModelCount}
              addSignal={addModelTick}
            />
          )}

          {tab === "claude" && (
            <ClaudeSetupCard keys={[keyItem]} models={models} baseUrl={baseUrl} revealed={revealed} />
          )}

          {tab === "openclaw" && (
            <OpenclawSetupCard keys={[keyItem]} models={models} baseUrl={baseUrl} revealed={revealed} />
          )}

          {tab === "thirdparty" && (
            <ThirdPartySetupCard keyItem={keyItem} models={models} baseUrl={baseUrl} revealed={revealed} />
          )}

          {(tab === "stats" || tab === "history") && (loading || !data) && (
            <div className="py-12 text-center text-ink-200/50 text-sm">Đang tải dữ liệu...</div>
          )}

          {tab === "stats" && !loading && data && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatPill label="Tổng requests" value={formatNumber(data.stats.totalRequests)} />
                <StatPill label="Tổng chi" value={formatUSD(data.stats.totalCost)} accent="emerald" />
                <StatPill label="Tokens" value={formatNumber(data.stats.totalInputTokens + data.stats.totalOutputTokens)} />
                <StatPill label="Lần dùng cuối" value={data.key.lastUsedAt ? formatDateTime(data.key.lastUsedAt) : "Chưa dùng"} small />
              </div>

              <Section title="Chi phí 7 ngày gần nhất">
                <div className="h-32 flex items-end gap-2">
                  {data.chart.map((c) => {
                    const h = Math.max(4, (c.cost / maxCost) * 100);
                    return (
                      <div key={c.date} className="flex-1 flex flex-col items-center gap-1.5" title={`${c.date}: ${formatUSD(c.cost)} · ${c.count} req`}>
                        <div className="w-full flex-1 flex items-end">
                          <div
                            className={`w-full rounded-t ${c.cost > 0 ? "bg-gradient-to-t from-sky-500/70 to-violet-500/70" : "bg-white/5"}`}
                            style={{ height: `${h}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-ink-200/40">{c.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section title="Top model sử dụng">
                {data.topModels.length === 0 ? (
                  <p className="text-sm text-ink-200/40 italic">Chưa có request nào.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.topModels.map((m) => (
                      <div key={m.slug} className="flex items-center justify-between text-sm py-2 px-3 rounded-lg bg-ink-950/40 border border-white/5">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{m.displayName}</p>
                          <p className="text-[11px] font-mono text-ink-200/40 truncate">{m.slug}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-sm">{formatNumber(m.count)} req</p>
                          <p className="text-[11px] font-mono text-emerald-300/80">{formatUSD(m.cost)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}

          {tab === "history" && !loading && data && (
            <Section title="20 request gần nhất">
              {data.recent.length === 0 ? (
                <p className="text-sm text-ink-200/40 italic">Chưa có request nào.</p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-ink-200/50 uppercase tracking-wider text-[10px]">Thời gian</th>
                        <th className="text-left px-3 py-2 font-medium text-ink-200/50 uppercase tracking-wider text-[10px]">Model</th>
                        <th className="text-right px-3 py-2 font-medium text-ink-200/50 uppercase tracking-wider text-[10px]">In/Out</th>
                        <th className="text-right px-3 py-2 font-medium text-ink-200/50 uppercase tracking-wider text-[10px]">Chi phí</th>
                        <th className="text-right px-3 py-2 font-medium text-ink-200/50 uppercase tracking-wider text-[10px]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((r) => (
                        <tr key={r.id} className="border-t border-white/5">
                          <td className="px-3 py-2 font-mono text-ink-200/70">{formatDateTime(r.createdAt)}</td>
                          <td className="px-3 py-2 font-mono">{r.modelName}</td>
                          <td className="px-3 py-2 font-mono text-right text-ink-200/70">{formatNumber(r.inputTokens)} / {formatNumber(r.outputTokens)}</td>
                          <td className="px-3 py-2 font-mono text-right text-emerald-300/80">{formatUSD(r.cost)}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={
                              r.status >= 200 && r.status < 300
                                ? "text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                : "text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20"
                            }>{r.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function TabPill({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border border-sky-400/40 bg-sky-500/15 text-sky-200 shadow-inner shadow-sky-500/10 whitespace-nowrap"
          : "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border border-white/5 bg-ink-950/40 text-ink-200/65 hover:text-white hover:border-white/15 transition whitespace-nowrap"
      }
    >
      {icon} {children}
    </button>
  );
}

function StatPill({ label, value, accent, small }: { label: string; value: string; accent?: "emerald"; small?: boolean }) {
  return (
    <div className="rounded-xl border border-white/5 bg-ink-950/40 px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-wider text-ink-200/50">{label}</p>
      <p className={`mt-1 font-semibold ${accent === "emerald" ? "text-emerald-400" : "text-ink-100"} ${small ? "text-sm" : "text-lg"}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-mono uppercase tracking-wider text-ink-200/60 mb-2">{title}</p>
      {children}
    </div>
  );
}
