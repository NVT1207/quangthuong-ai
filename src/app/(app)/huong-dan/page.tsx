import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { DOCS_SECTIONS } from "./docs-data";

export const dynamic = "force-dynamic";

export default function HuongDanIndex() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Hướng dẫn</h1>
        <p className="text-sm text-ink-200/60">
          Tích hợp QUANGTHUONG AI vào dự án của bạn — endpoint OpenAI-compatible, ví dụ Python/Node/cURL, tips tối ưu chi phí.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {DOCS_SECTIONS.map((s) => (
          <Link
            key={s.slug}
            href={`/huong-dan/${s.slug}`}
            className="card p-5 hover:border-honey-500/40 transition group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-honey-500/10 border border-honey-500/20 flex items-center justify-center text-xl shrink-0">
                {s.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold mb-1 group-hover:text-honey-300 transition">{s.title}</h3>
                <p className="text-sm text-ink-200/60 line-clamp-2">{s.summary}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-3">Bắt đầu nhanh trong 30 giây</h3>
        <div className="text-sm">
          <Markdown source={QUICK_START} />
        </div>
      </div>
    </div>
  );
}

const QUICK_START = `1. **Đăng nhập** vào dashboard và vào mục \`API Keys\`.
2. **Tạo key mới** — copy ngay vì key đầy đủ chỉ hiển thị một lần.
3. Đổi \`base_url\` trong OpenAI SDK của bạn sang \`/api/v1\` của QUANGTHUONG AI.
4. Gọi như bình thường — đổi \`model\` để chuyển provider.

\`\`\`bash
curl https://quangthuong.ai/api/v1/chat/completions \\
  -H "Authorization: Bearer sk-bee-..." \\
  -H "Content-Type: application/json" \\
  -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"Xin chào"}]}'
\`\`\``;
