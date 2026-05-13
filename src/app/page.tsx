import Link from "next/link";
import { ArrowRight, Check, Sparkles, Zap, Wallet, Shield, Activity } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatUSD } from "@/lib/format";
import { CodeTabs, FaqAccordion } from "./_landing-interactive";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [modelCount, providers, featuredModels] = await Promise.all([
    prisma.model.count({ where: { active: true } }),
    prisma.model.findMany({
      where: { active: true },
      select: { provider: true },
      distinct: ["provider"],
    }),
    prisma.model.findMany({
      where: { active: true, category: "text" },
      orderBy: { inputPrice: "asc" },
      take: 6,
    }),
  ]);

  return (
    <div className="bg-ink-950 text-white min-h-screen">
      <Header />
      <Hero modelCount={modelCount} providerCount={providers.length} />
      <Features />
      <ModelsShowcase models={featuredModels} />
      <CodeSection />
      <Faq />
      <BottomCTA />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-ink-950/70 border-b border-white/5">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <svg width={28} height={28} viewBox="0 0 40 40" fill="none">
            <defs>
              <linearGradient id="qt-grad-dark" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fbbf24" />
                <stop offset="1" stopColor="#d97706" />
              </linearGradient>
            </defs>
            <path
              d="M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z"
              fill="url(#qt-grad-dark)"
              stroke="#451a03"
              strokeWidth="1.5"
            />
            <text x="20" y="26" textAnchor="middle" fontSize="14" fontWeight="800" fill="#451a03" fontFamily="ui-sans-serif, system-ui">QT</text>
          </svg>
          <span className="font-bold text-lg tracking-tight text-white">
            QUANG<span className="text-honey-400">THUONG</span> AI
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-ink-200/60">
          <a href="#features" className="hover:text-white transition">Tính năng</a>
          <a href="#models" className="hover:text-white transition">Models</a>
          <a href="#integrations" className="hover:text-white transition">Tích hợp</a>
          <a href="#faq" className="hover:text-white transition">FAQs</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="px-4 py-2 text-sm font-medium text-ink-200/80 hover:text-white transition">
            Đăng nhập
          </Link>
          <Link href="/register" className="px-4 py-2 rounded-full bg-honey-500 text-ink-950 text-sm font-semibold hover:bg-honey-400 transition shadow-glow">
            Bắt đầu
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ modelCount, providerCount }: { modelCount: number; providerCount: number }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-honey-500/15 blur-[120px] rounded-full" />
        <div className="absolute top-40 right-20 w-[400px] h-[400px] bg-orange-500/10 blur-[100px] rounded-full" />
        <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-amber-500/5 blur-[120px] rounded-full" />
      </div>
      <div className="mx-auto max-w-5xl px-6 py-24 md:py-32 text-center">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] text-white">
          API AI siêu nhanh, siêu rẻ
          <br />
          <span className="text-ink-200/70 text-4xl md:text-5xl font-semibold">
            ChatGPT · Claude · Gemini · Grok
          </span>
        </h1>
        <p className="mt-8 text-lg text-ink-200/70 max-w-2xl mx-auto leading-relaxed">
          Truy cập mọi mô hình AI hàng đầu qua 1 endpoint duy nhất tương thích OpenAI.
          Thanh toán bằng VND, dùng tới đâu trừ tới đó — chỉ với 1 dòng code.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-honey-500 text-ink-950 font-semibold hover:bg-honey-400 transition shadow-glow"
          >
            Bắt đầu ngay <ArrowRight size={16} />
          </Link>
          <Link
            href="#integrations"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 hover:border-white/20 transition"
          >
            Xem tài liệu
          </Link>
        </div>
        <div className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
          <Stat number={`${modelCount}+`} label="Mô hình AI" />
          <Stat number={`${providerCount}`} label="Nhà cung cấp" />
          <Stat number="VND" label="Thanh toán nội tệ" />
        </div>
      </div>
    </section>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-4xl md:text-5xl font-bold text-white">{number}</p>
      <p className="text-xs md:text-sm text-ink-200/50 mt-2 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function Features() {
  const items = [
    {
      icon: Sparkles,
      title: "Unified API",
      desc: "Mọi mô hình AI hàng đầu qua 1 endpoint duy nhất. Tương thích OpenAI SDK hoàn toàn — không cần sửa code.",
    },
    {
      icon: Wallet,
      title: "Thanh toán VND",
      desc: "Chuyển khoản ngân hàng nội địa hoặc MoMo. Không cần thẻ quốc tế, không subscription, không cam kết.",
    },
    {
      icon: Zap,
      title: "Streaming siêu nhanh",
      desc: "Hỗ trợ streaming SSE chuẩn OpenAI và Anthropic. Token bắt đầu hiện trong ~300ms — UX chat mượt mà.",
    },
    {
      icon: Shield,
      title: "An toàn bảo mật",
      desc: "API key hash bcrypt, mã hoá AES-256-GCM. Không lưu prompt/response sau xử lý. Rate limit chống abuse.",
    },
    {
      icon: Activity,
      title: "Theo dõi chi tiết",
      desc: "Log từng request, biểu đồ usage theo ngày, breakdown theo model. Export CSV để báo cáo.",
    },
    {
      icon: Check,
      title: "Tích hợp 30 giây",
      desc: "SDK Python, Node.js, hoặc cURL — chỉ thay 2 dòng cấu hình. Test ngay với Claude Code CLI, Codex CLI.",
    },
  ];
  return (
    <section id="features" className="py-24 bg-ink-900/30 border-y border-white/5">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16">
          <p className="text-sm text-honey-400/80 uppercase tracking-widest mb-3">/ features /</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white max-w-2xl">
            Tích hợp AI<br />cực kỳ đơn giản
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it, i) => (
            <div key={i} className="p-7 rounded-2xl bg-ink-900/60 border border-white/5 backdrop-blur-xl hover:border-honey-500/30 hover:bg-ink-900/80 transition">
              <span className="inline-flex w-11 h-11 items-center justify-center rounded-xl bg-honey-500/15 text-honey-300 mb-5 border border-honey-500/20">
                <it.icon size={20} />
              </span>
              <h3 className="font-bold text-lg mb-2 text-white">{it.title}</h3>
              <p className="text-sm text-ink-200/70 leading-relaxed">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModelsShowcase({ models }: { models: any[] }) {
  return (
    <section id="models" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16">
          <p className="text-sm text-honey-400/80 uppercase tracking-widest mb-3">/ models /</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white max-w-2xl">
            Mô hình hàng đầu<br />giá tốt nhất
          </h2>
        </div>
        <div className="rounded-2xl border border-white/5 overflow-hidden bg-ink-900/60 backdrop-blur-xl">
          <div className="hidden md:grid grid-cols-12 px-6 py-4 bg-white/[0.02] border-b border-white/5 text-xs font-semibold uppercase tracking-wider text-ink-200/60">
            <div className="col-span-3">Model</div>
            <div className="col-span-5">Mô tả</div>
            <div className="col-span-2 text-right">Input / 1M tokens</div>
            <div className="col-span-2 text-right">Output / 1M tokens</div>
          </div>
          {models.map((m) => (
            <div key={m.id} className="grid md:grid-cols-12 gap-2 px-6 py-5 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition">
              <div className="col-span-3 flex items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-ink-200/70 font-medium border border-white/5">{m.provider}</span>
                <span className="font-semibold text-white">{m.displayName}</span>
              </div>
              <div className="col-span-5 text-sm text-ink-200/70">{m.description || "—"}</div>
              <div className="col-span-2 text-right text-sm font-mono text-honey-300">{formatUSD(m.inputPrice)}</div>
              <div className="col-span-2 text-right text-sm font-mono text-honey-300">{formatUSD(m.outputPrice)}</div>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link href="/register" className="inline-flex items-center gap-2 text-sm font-medium text-ink-200/70 hover:text-white transition">
            Xem đầy đủ bảng giá <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function CodeSection() {
  return (
    <section id="integrations" className="py-24 bg-ink-900/30 border-y border-white/5">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center mb-12">
          <p className="text-sm text-honey-400/80 uppercase tracking-widest mb-3">/ integrations /</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Chỉ thay 1 dòng code
          </h2>
          <p className="mt-4 text-ink-200/70">
            Tương thích 100% OpenAI SDK — Python, Node.js, cURL
          </p>
        </div>
        <CodeTabs />
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-12">
          <p className="text-sm text-honey-400/80 uppercase tracking-widest mb-3">/ faq /</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white max-w-2xl">
            Mọi thứ bạn cần<br />biết trước khi dùng
          </h2>
        </div>
        <FaqAccordion />
      </div>
    </section>
  );
}

function BottomCTA() {
  return (
    <section className="relative overflow-hidden border-y border-white/5">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-honey-500/10 blur-[120px] rounded-full" />
      </div>
      <div className="mx-auto max-w-7xl px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-4xl md:text-5xl font-bold leading-tight text-white">
            Bắt đầu xây dựng<br />
            <span className="text-honey-400">với AI ngay hôm nay</span>
          </h2>
          <p className="mt-6 text-ink-200/70 max-w-md leading-relaxed">
            Gần hơn tương lai, chạm đến thế giới chỉ chờ bạn quyết định ngay bây giờ.
          </p>
        </div>
        <div className="md:text-right">
          <p className="text-2xl font-bold mb-2 text-white">Bắt đầu trong 30 giây</p>
          <p className="text-ink-200/60 mb-6">
            Đăng ký, tạo API key, nạp tiền — chỉ vài cú click.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-honey-500 text-ink-950 font-semibold hover:bg-honey-400 transition shadow-glow"
          >
            Tạo tài khoản <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-ink-950 text-ink-200/70 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-6 py-12 grid md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <svg width={24} height={24} viewBox="0 0 40 40" fill="none">
              <defs>
                <linearGradient id="qt-grad-footer" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#fbbf24" />
                  <stop offset="1" stopColor="#d97706" />
                </linearGradient>
              </defs>
              <path d="M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z" fill="url(#qt-grad-footer)" />
              <text x="20" y="26" textAnchor="middle" fontSize="14" fontWeight="800" fill="#451a03">QT</text>
            </svg>
            <span className="font-bold tracking-tight text-white">
              QUANG<span className="text-honey-400">THUONG</span> AI
            </span>
          </div>
          <p className="text-sm text-ink-200/50">
            © {new Date().getFullYear()} QUANGTHUONG AI. <br />Cổng API AI cho lập trình viên Việt Nam.
          </p>
        </div>
        <div>
          <p className="font-semibold text-white mb-4">Liên hệ</p>
          <ul className="space-y-2 text-sm">
            <li><a href="mailto:support@quangthuong-ai.com" className="text-ink-200/60 hover:text-white transition">Email hỗ trợ</a></li>
            <li><a href="#" className="text-ink-200/60 hover:text-white transition">Zalo Group</a></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-white mb-4">Sản phẩm</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/huong-dan" className="text-ink-200/60 hover:text-white transition">API Docs</Link></li>
            <li><Link href="/register" className="text-ink-200/60 hover:text-white transition">Tạo tài khoản</Link></li>
            <li><Link href="/dashboard" className="text-ink-200/60 hover:text-white transition">Dashboard</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-white mb-4">Tài nguyên</p>
          <ul className="space-y-2 text-sm">
            <li><a href="#models" className="text-ink-200/60 hover:text-white transition">Danh sách Models</a></li>
            <li><a href="#integrations" className="text-ink-200/60 hover:text-white transition">Tích hợp SDK</a></li>
            <li><a href="#faq" className="text-ink-200/60 hover:text-white transition">FAQs</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
