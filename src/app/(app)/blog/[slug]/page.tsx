import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await prisma.blogPost.findUnique({ where: { slug: params.slug } });
  if (!post || !post.published) return notFound();

  const related = await prisma.blogPost.findMany({
    where: { published: true, NOT: { id: post.id } },
    orderBy: { publishedAt: "desc" },
    take: 3,
  });

  return (
    <div className="space-y-8 max-w-3xl">
      <Link href="/blog" className="inline-flex items-center gap-1 text-xs text-ink-200/60 hover:text-honey-300">
        <ArrowLeft size={12} /> Quay lại blog
      </Link>

      <article className="card p-6 md:p-8">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-14 h-14 rounded-lg bg-honey-500/10 border border-honey-500/20 flex items-center justify-center text-3xl shrink-0">
            {post.coverEmoji}
          </div>
          <div>
            <span className="badge bg-white/5 text-ink-200/70 text-[10px]">{post.tag}</span>
            <p className="text-xs text-ink-200/40 mt-1">{formatDate(post.publishedAt)}</p>
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-3">{post.title}</h1>
        <p className="text-ink-200/70 text-base leading-relaxed border-l-2 border-honey-500/30 pl-4 mb-6">
          {post.excerpt}
        </p>

        <div className="text-sm">
          <Markdown source={post.content} />
        </div>
      </article>

      {related.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-ink-200/80">Bài viết liên quan</h3>
          <div className="grid md:grid-cols-3 gap-3">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/blog/${r.slug}`}
                className="card p-4 hover:border-honey-500/40 transition group"
              >
                <div className="text-2xl mb-2">{r.coverEmoji}</div>
                <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-honey-300">
                  {r.title}
                </p>
                <p className="text-[10px] text-ink-200/40 mt-2">{formatDate(r.publishedAt)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
