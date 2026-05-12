import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Sparkles, Bug, Wrench } from "lucide-react";

export const dynamic = "force-dynamic";

const KIND_META: Record<string, { label: string; cls: string; Icon: any }> = {
  feature: { label: "Tính năng mới", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20", Icon: Sparkles },
  improvement: { label: "Cải tiến", cls: "bg-sky-500/15 text-sky-300 border-sky-500/20", Icon: Wrench },
  fix: { label: "Sửa lỗi", cls: "bg-rose-500/15 text-rose-300 border-rose-500/20", Icon: Bug },
};

export default async function ChangelogPage() {
  const entries = await prisma.changelogEntry.findMany({ orderBy: { releasedAt: "desc" } });
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Changelog</h1>
        <p className="text-sm text-ink-200/60">Lịch sử cập nhật của QUANGTHUONG AI — tính năng mới, cải tiến và sửa lỗi.</p>
      </div>

      <ol className="space-y-4 relative">
        <span aria-hidden className="absolute left-[10px] top-2 bottom-2 w-px bg-white/5" />
        {entries.map((e) => {
          const meta = KIND_META[e.kind] ?? KIND_META.feature;
          const Icon = meta.Icon;
          return (
            <li key={e.id} className="relative pl-8">
              <span className="absolute left-0 top-1 w-5 h-5 rounded-full bg-honey-500/15 border border-honey-400/40 flex items-center justify-center">
                <Icon size={11} className="text-honey-300" />
              </span>
              <article className="card p-5">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="badge bg-honey-500/15 text-honey-300 border border-honey-500/20 font-mono">{e.version}</span>
                  <span className={`badge border ${meta.cls}`}>{meta.label}</span>
                  <span className="text-xs text-ink-200/40 ml-auto">{formatDate(e.releasedAt)}</span>
                </div>
                <h2 className="font-semibold mb-2">{e.title}</h2>
                <div className="text-sm text-ink-200/70 whitespace-pre-line">{e.content}</div>
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
