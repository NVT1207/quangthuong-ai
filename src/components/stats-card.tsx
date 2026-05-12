import type { LucideIcon } from "lucide-react";

export function StatsCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "honey",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: "honey" | "blue" | "green" | "rose";
}) {
  const accents = {
    honey: "text-honey-400 bg-honey-500/10 border-honey-500/20",
    blue: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    green: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  } as const;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-200/60">{label}</p>
        <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border ${accents[accent]}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-200/50">{hint}</p>}
    </div>
  );
}
