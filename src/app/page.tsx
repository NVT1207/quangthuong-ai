import Link from "next/link";
import { ArrowRight, Boxes, KeyRound, Zap, Shield, Wallet, Activity } from "lucide-react";
import { Logo } from "@/components/logo";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const models = await prisma.model.findMany({ where: { active: true }, take: 6, orderBy: { inputPrice: "asc" } });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-ink-950/70 border-b border-white/5">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-3">
          <Logo />
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-ink-200/70 hover:text-white">Tính năng</a>
            <a href="#models" className="text-ink-200/70 hover:text-white">Models</a>
            <a href="#docs" className="text-ink-200/70 hover:text-white">API Docs</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost">Đăng nhập</Link>
            <Link href="/register" className="btn btn-primary">Đăng ký</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-honey-500/20 blur-[120px] rounded-full" />
        </div>
        <div className="mx-auto max-w-7xl px-6 py-24 text-center">
          <span className="badge bg-honey-500/10 text-honey-300 border border-honey-500/20 mb-6">
            🐝 Mới: Hỗ trợ Claude Sonnet 4 và Gemini 2.5 Pro
          </span>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Mọi <span className="text-honey-400">AI Model</span> bạn cần,<br />
            trong <span className="text-honey-400">một API</span> duy nhất.
          </h1>
          <p className="mt-6 text-lg text-ink-200/70 max-w-2xl mx-auto">
            Truy cập GPT, Claude, Gemini, DeepSeek, Llama và nhiều model AI hàng đầu khác qua endpoint tương thích OpenAI.
            Nạp tiền VND, dùng tới đâu trừ tới đó. Không subscription, không cam kết.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className="btn btn-primary text-base px-6 py-3">
              Bắt đầu miễn phí <ArrowRight size={16} />
            </Link>
            <Link href="#docs" className="btn btn-ghost text-base px-6 py-3">Xem tài liệu API</Link>
          </div>
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <Stat number="13+" label="Model AI" />
            <Stat number="99.9%" label="Uptime" />
            <Stat number="< 100ms" label="Latency p50" />
            <Stat number="VND" label="Thanh toán nội tệ" />
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Vì sao chọn QUANGTHUONG AI?</h2>
        <div className="grid md:grid-cols-3 gap-5">
          <Feature icon={Boxes} title="Nhiều model 1 API" desc="OpenAI, Anthropic, Google, Meta, DeepSeek... Đổi model chỉ bằng 1 dòng code." />
          <Feature icon={KeyRound} title="API Key bảo mật" desc="Mỗi project 1 key. Revoke ngay khi cần. Hash bcrypt." />
          <Feature icon={Zap} title="Tương thích OpenAI" desc="Endpoint /v1/chat/completions chuẩn. SDK OpenAI chạy ngay." />
          <Feature icon={Wallet} title="Nạp tiền VND" desc="Chuyển khoản ngân hàng nội địa, MoMo. Không cần thẻ quốc tế." />
          <Feature icon={Activity} title="Theo dõi chi tiết" desc="Log từng request, biểu đồ usage, export CSV." />
          <Feature icon={Shield} title="Riêng tư" desc="Không lưu nội dung prompt sau khi xử lý. Chỉ lưu metric." />
        </div>
      </section>

      <section id="models" className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-2">Bảng giá rõ ràng</h2>
        <p className="text-center text-ink-200/60 mb-12">Giá tính theo VND cho mỗi 1 triệu token</p>
        <div className="overflow-x-auto">
          <table className="w-full card">
            <thead>
              <tr>
                <th className="table-th">Model</th>
                <th className="table-th">Provider</th>
                <th className="table-th text-right">Input / 1M token</th>
                <th className="table-th text-right">Output / 1M token</th>
                <th className="table-th text-right">Context</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id}>
                  <td className="table-td font-semibold">{m.displayName}</td>
                  <td className="table-td"><span className="badge bg-white/5">{m.provider}</span></td>
                  <td className="table-td text-right text-honey-300">{formatNumber(m.inputPrice)} ₫</td>
                  <td className="table-td text-right text-honey-300">{formatNumber(m.outputPrice)} ₫</td>
                  <td className="table-td text-right text-ink-200/70">{formatNumber(m.contextLength)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-center mt-6">
          <Link href="/register" className="btn btn-primary">Tạo tài khoản và xem đầy đủ</Link>
        </div>
      </section>

      <section id="docs" className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Tích hợp trong 30 giây</h2>
        <div className="card p-6 max-w-3xl mx-auto">
          <p className="text-sm text-ink-200/60 mb-3">cURL — endpoint OpenAI-compatible:</p>
          <pre className="text-xs md:text-sm bg-black/40 rounded-xl p-4 overflow-x-auto"><code>{`curl http://localhost:3000/api/v1/chat/completions \\
  -H "Authorization: Bearer sk-bee-XXXXXXXX" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Xin chào!"}]
  }'`}</code></pre>
        </div>
      </section>

      <footer className="border-t border-white/5 mt-16">
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-ink-200/60">
          <Logo />
          <p>© {new Date().getFullYear()} QUANGTHUONG AI. Demo — không dùng cho production.</p>
        </div>
      </footer>
    </div>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-bold text-honey-400">{number}</p>
      <p className="text-xs text-ink-200/60 mt-1">{label}</p>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: any) {
  return (
    <div className="card p-6">
      <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-honey-500/10 border border-honey-500/20 text-honey-400 mb-4">
        <Icon size={18} />
      </span>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-ink-200/60">{desc}</p>
    </div>
  );
}
