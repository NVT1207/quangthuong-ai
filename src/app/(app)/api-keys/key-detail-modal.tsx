"use client";
import { useEffect, useState } from "react";
import { X, BarChart3, Clock, Hash, DollarSign, Activity, Terminal, Boxes } from "lucide-react";
import { formatUSD, formatNumber, formatDateTime } from "@/lib/format";
import { CliPanels, type KeyItem, type ModelOpt } from "./cli-panels";
import { ModelsTab } from "./models-tab";

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

export function KeyDetailModal({ keyId, onClose, baseUrl, models, keyItem, revealed }: Props) {
  const [tab, setTab] = useState<"stats" | "models" | "cli">("stats");
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelCount, setModelCount] = useState<number | null>(null);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-ink-900 border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 border-b border-white/5 bg-ink-900/95 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs font-mono uppercase tracking-wider text-ink-200/40">Chi tiết API Key</p>
            <p className="text-lg font-semibold truncate">{data?.key.name ?? "Đang tải..."}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-ink-200/60 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {loading || !data ? (
          <div className="p-12 text-center text-ink-200/50 text-sm">Đang tải dữ liệu...</div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <code className="font-mono text-xs px-2.5 py-1 rounded-lg bg-ink-950/60 border border-white/5">{data.key.prefix}...{data.key.suffix}</code>
              <span className={
                data.key.enabled
                  ? "text-[11px] font-medium px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "text-[11px] font-medium px-2 py-0.5 rounded border border-ink-500/30 bg-ink-500/10 text-ink-200/60"
              }>
                {data.key.enabled ? "Active" : "Tắt"}
              </span>
              <span className="text-ink-200/50 text-xs">Tạo: {formatDateTime(data.key.createdAt)}</span>
            </div>

            <div className="flex gap-1 border-b border-white/5 -mx-6 px-6">
              <TabButton active={tab === "stats"} onClick={() => setTab("stats")} icon={<BarChart3 size={13} />}>Thống kê</TabButton>
              <TabButton active={tab === "models"} onClick={() => setTab("models")} icon={<Boxes size={13} />}>
                Models{modelCount !== null && <span className="ml-1 text-ink-200/40">({modelCount})</span>}
              </TabButton>
              <TabButton active={tab === "cli"} onClick={() => setTab("cli")} icon={<Terminal size={13} />}>Cài đặt CLI</TabButton>
            </div>

            {tab === "models" ? (
              <ModelsTab keyId={keyId} onCountChange={setModelCount} />
            ) : tab === "cli" ? (
              <CliPanels
                keys={[keyItem]}
                models={models}
                baseUrl={baseUrl}
                revealed={revealed}
              />
            ) : (
              <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={<Activity size={14} />} label="Tổng requests" value={formatNumber(data.stats.totalRequests)} />
              <StatCard icon={<DollarSign size={14} />} label="Tổng chi" value={formatUSD(data.stats.totalCost)} accent="emerald" />
              <StatCard icon={<Hash size={14} />} label="Tokens" value={formatNumber(data.stats.totalInputTokens + data.stats.totalOutputTokens)} />
              <StatCard icon={<Clock size={14} />} label="Lần dùng cuối" value={data.key.lastUsedAt ? formatDateTime(data.key.lastUsedAt) : "Chưa dùng"} small />
            </div>

            <Section icon={<BarChart3 size={14} />} title="Chi phí 7 ngày gần nhất">
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
                    <div key={m.slug} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-ink-950/40 border border-white/5">
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 border-sky-400 text-sky-300"
          : "inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-ink-200/60 hover:text-ink-100"
      }
    >
      {icon} {children}
    </button>
  );
}

function StatCard({ icon, label, value, accent, small }: { icon: React.ReactNode; label: string; value: string; accent?: "emerald"; small?: boolean }) {
  return (
    <div className="rounded-xl border border-white/5 bg-ink-950/40 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-ink-200/50">{icon} {label}</p>
      <p className={`mt-1 font-semibold ${accent === "emerald" ? "text-emerald-400" : "text-ink-100"} ${small ? "text-sm" : "text-lg"}`}>{value}</p>
    </div>
  );
}

function Section({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-ink-200/60 mb-2">
        {icon}{title}
      </p>
      {children}
    </div>
  );
}
