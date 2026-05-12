import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Blog</h1>
        <p className="text-sm text-ink-200/60">
          Tin tức, hướng dẫn và case study về QUANGTHUONG AI và thế giới AI nói chung.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="card p-10 text-center text-ink-200/60">Chưa có bài viết nào.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/blog/${p.slug}`}
              className="card p-5 hover:border-honey-500/40 transition group flex flex-col"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg bg-honey-500/10 border border-honey-500/20 flex items-center justify-center text-2xl shrink-0">
                  {p.coverEmoji}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="badge bg-white/5 text-ink-200/70 text-[10px]">{p.tag}</span>
                  <p className="text-xs text-ink-200/40 mt-1">{formatDate(p.publishedAt)}</p>
                </div>
              </div>
              <h2 className="font-semibold mb-2 group-hover:text-honey-300 transition leading-snug">
                {p.title}
              </h2>
              <p className="text-sm text-ink-200/70 line-clamp-3 mb-3">{p.excerpt}</p>
              <div className="mt-auto flex items-center gap-1 text-xs text-honey-300/80 group-hover:text-honey-300">
                Đọc tiếp <ArrowRight size={12} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
