"use client";

import Link from "next/link";
import { Check, Code2, Copy, Terminal, Zap } from "lucide-react";
import { useMemo, useState } from "react";

const models = [
  "qwen-3-235b-a22b-instruct-2507",
  "glm-4.7-flash",
  "gpt-5.5",
];

const setupUrl = "/api/v1/llm/setup-claudecode";

export default function ClaudeCodeSetupPage() {
  const [apiKey, setApiKey] = useState("");
  const [os, setOs] = useState("mac");
  const [haiku, setHaiku] = useState(models[0]);
  const [sonnet, setSonnet] = useState(models[0]);
  const [opus, setOpus] = useState(models[0]);
  const [copied, setCopied] = useState(false);

  const command = useMemo(() => {
    if (typeof window === "undefined") return "";

    const url = new URL(setupUrl, window.location.origin);
    url.searchParams.set("key", apiKey || "API_KEY_CUA_BAN");
    url.searchParams.set("os", os);
    url.searchParams.set("haiku", haiku);
    url.searchParams.set("sonnet", sonnet);
    url.searchParams.set("opus", opus);

    return `curl -sL "${url.toString()}" | sh`;
  }, [apiKey, os, haiku, sonnet, opus]);

  async function copyCommand() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-ink-950 text-white">
      <Header />
      <section className="relative">
        <div className="absolute inset-0 -z-0">
          <div className="absolute left-1/2 top-10 h-[720px] w-[720px] -translate-x-1/2 rounded-full bg-honey-500/15 blur-[130px]" />
          <div className="absolute right-10 top-72 h-[420px] w-[420px] rounded-full bg-orange-500/10 blur-[110px]" />
          <div className="absolute -left-32 top-40 h-[440px] w-[440px] rounded-full bg-amber-500/5 blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 md:py-24">
          <div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="lg:sticky lg:top-28">
              <p className="mb-4 text-sm uppercase tracking-widest text-honey-400/80">/ claude code setup /</p>
              <h1 className="text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
                Cài Claude Code
                <span className="block text-ink-200/70">trong 30 giây</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-200/70">
                Nhập API key, chọn model rồi copy một dòng lệnh để cấu hình Claude Code qua endpoint của QUANGTHUONG AI.
              </p>

              <div className="mt-10 grid gap-3 text-sm text-ink-200/70 sm:grid-cols-3 lg:grid-cols-1">
                <Feature icon={Zap} title="Nhanh" desc="Tạo lệnh curl tự động" />
                <Feature icon={Terminal} title="Đúng chuẩn" desc="Ghi ~/.claude/settings.json" />
                <Feature icon={Check} title="Có backup" desc="Giữ lại config cũ trước khi sửa" />
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-ink-900/70 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="rounded-[1.5rem] border border-white/5 bg-ink-950/70 p-5 md:p-7">
                <div className="flex items-center gap-3 border-b border-white/5 pb-5">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-honey-500/20 bg-honey-500/15 text-honey-300">
                    <Code2 size={20} />
                  </span>
                  <div>
                    <h2 className="text-xl font-bold">Tạo lệnh setup</h2>
                    <p className="text-sm text-ink-200/55">Key chỉ dùng để sinh command trên trình duyệt.</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="label" htmlFor="api-key">API key</label>
                    <input
                      id="api-key"
                      className="input h-12"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder="sk-..."
                      type="password"
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="os">Hệ điều hành</label>
                    <select id="os" className="input h-12" value={os} onChange={(event) => setOs(event.target.value)}>
                      <option value="mac">macOS</option>
                      <option value="linux">Linux</option>
                    </select>
                  </div>

                  <ModelSelect label="Haiku model" value={haiku} onChange={setHaiku} />
                  <ModelSelect label="Sonnet model" value={sonnet} onChange={setSonnet} />
                  <ModelSelect label="Opus model" value={opus} onChange={setOpus} />
                </div>

                <div className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-black/50">
                  <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink-200/80">
                      <Terminal size={16} className="text-honey-300" /> Install command
                    </div>
                    <button
                      className="inline-flex items-center gap-2 rounded-full bg-honey-500 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-honey-400"
                      onClick={copyCommand}
                      type="button"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Đã copy" : "Copy"}
                    </button>
                  </div>
                  <pre className="max-h-[260px] min-h-[180px] overflow-auto whitespace-pre-wrap break-all p-5 font-mono text-sm leading-relaxed text-honey-200">
                    {command}
                  </pre>
                </div>

                <p className="mt-4 text-xs leading-relaxed text-ink-200/45">
                  Sau khi chạy lệnh, mở terminal mới hoặc source shell rc rồi chạy <span className="font-mono text-honey-300">claude</span>. Nếu được hỏi đăng nhập, dùng <span className="font-mono text-honey-300">/login</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <svg width={28} height={28} viewBox="0 0 40 40" fill="none">
            <defs>
              <linearGradient id="qt-grad-setup" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fbbf24" />
                <stop offset="1" stopColor="#d97706" />
              </linearGradient>
            </defs>
            <path d="M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z" fill="url(#qt-grad-setup)" stroke="#451a03" strokeWidth="1.5" />
            <text x="20" y="26" textAnchor="middle" fontSize="14" fontWeight="800" fill="#451a03" fontFamily="ui-sans-serif, system-ui">QT</text>
          </svg>
          <span className="text-lg font-bold tracking-tight text-white">
            QUANG<span className="text-honey-400">THUONG</span> AI
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/login" className="px-4 py-2 text-sm font-medium text-ink-200/80 transition hover:text-white">
            Đăng nhập
          </Link>
          <Link href="/register" className="rounded-full bg-honey-500 px-4 py-2 text-sm font-semibold text-ink-950 shadow-glow transition hover:bg-honey-400">
            Bắt đầu
          </Link>
        </div>
      </div>
    </header>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: typeof Zap; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-ink-900/60 p-4 backdrop-blur-xl">
      <Icon size={18} className="mb-3 text-honey-300" />
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs text-ink-200/55">{desc}</p>
    </div>
  );
}

function ModelSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input h-12" value={value} onChange={(event) => onChange(event.target.value)}>
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </div>
  );
}
