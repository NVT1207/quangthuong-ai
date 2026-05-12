import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { DOCS_SECTIONS, getDocSection } from "../docs-data";
import { ArrowLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default function DocSectionPage({ params }: { params: { slug: string } }) {
  const section = getDocSection(params.slug);
  if (!section) return notFound();

  const idx = DOCS_SECTIONS.findIndex((s) => s.slug === section.slug);
  const prev = idx > 0 ? DOCS_SECTIONS[idx - 1] : null;
  const next = idx < DOCS_SECTIONS.length - 1 ? DOCS_SECTIONS[idx + 1] : null;

  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-6 max-w-5xl">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Link href="/huong-dan" className="inline-flex items-center gap-1 text-xs text-ink-200/60 hover:text-honey-300 mb-3">
          <ArrowLeft size={12} /> Mục lục
        </Link>
        <nav className="space-y-0.5 text-sm">
          {DOCS_SECTIONS.map((s) => {
            const active = s.slug === section.slug;
            return (
              <Link
                key={s.slug}
                href={`/huong-dan/${s.slug}`}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition ${
                  active
                    ? "bg-honey-500/15 text-honey-200 border border-honey-500/20"
                    : "text-ink-200/70 hover:bg-white/5 hover:text-ink-200 border border-transparent"
                }`}
              >
                <span>{s.emoji}</span>
                <span className="truncate">{s.title}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <article className="min-w-0">
        <div className="card p-6 md:p-8">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-12 h-12 rounded-lg bg-honey-500/10 border border-honey-500/20 flex items-center justify-center text-2xl shrink-0">
              {section.emoji}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-200/40 mb-1">Hướng dẫn</p>
              <h1 className="text-2xl font-bold leading-tight">{section.title}</h1>
            </div>
          </div>
          <p className="text-ink-200/70 leading-relaxed border-l-2 border-honey-500/30 pl-4 mb-6">
            {section.summary}
          </p>
          <div className="text-sm">
            <Markdown source={section.content} />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          {prev && (
            <Link href={`/huong-dan/${prev.slug}`} className="card p-4 flex-1 hover:border-honey-500/40 transition group">
              <p className="text-[10px] text-ink-200/40 uppercase mb-1">← Trước</p>
              <p className="text-sm font-medium group-hover:text-honey-300">{prev.title}</p>
            </Link>
          )}
          {next && (
            <Link href={`/huong-dan/${next.slug}`} className="card p-4 flex-1 hover:border-honey-500/40 transition group text-right ml-auto">
              <p className="text-[10px] text-ink-200/40 uppercase mb-1">Tiếp →</p>
              <p className="text-sm font-medium group-hover:text-honey-300 inline-flex items-center gap-1">
                {next.title} <ChevronRight size={12} />
              </p>
            </Link>
          )}
        </div>
      </article>
    </div>
  );
}
