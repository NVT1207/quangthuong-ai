"use client";
import { useMemo, useState } from "react";
import { Copy, Check, AlertTriangle, Globe, Key, Eye, EyeOff, Sparkles, Box } from "lucide-react";
import type { KeyItem, ModelOpt } from "./cli-panels";

type Props = { keyItem: KeyItem; models: ModelOpt[]; baseUrl: string; revealed?: Record<string, string> };

type Flavor = "anthropic" | "openai";
type Preset = {
  id: string;
  name: string;
  flavor: Flavor;
  hint: string;
  envExample?: string;
};

const PRESETS: Preset[] = [
  {
    id: "claude-sdk",
    name: "Claude SDK / Anthropic SDK (Python, JS, Go...)",
    flavor: "anthropic",
    hint: "Đặt ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY, SDK gọi /v1/messages.",
    envExample:
      "export ANTHROPIC_BASE_URL=\"{BASE}\"\nexport ANTHROPIC_AUTH_TOKEN=\"{KEY}\"\nexport ANTHROPIC_API_KEY=\"{KEY}\"",
  },
  {
    id: "cline",
    name: "Cline / Roo Code (VSCode)",
    flavor: "anthropic",
    hint: 'API Provider: "Anthropic" → Custom Base URL = {BASE} → API Key = {KEY}',
  },
  {
    id: "cursor",
    name: "Cursor — Custom OpenAI",
    flavor: "openai",
    hint: 'Settings → Models → OpenAI API Key = {KEY}, Base URL Override = {BASE}/v1',
  },
  {
    id: "cherry",
    name: "Cherry Studio",
    flavor: "openai",
    hint: 'Cài đặt → Nhà cung cấp → OpenAI Compatible → Endpoint = {BASE}/v1, API Key = {KEY}',
  },
  {
    id: "lobechat",
    name: "LobeChat",
    flavor: "openai",
    hint: 'Settings → Provider → OpenAI → API Endpoint = {BASE}/v1, API Key = {KEY}',
  },
  {
    id: "openwebui",
    name: "Open WebUI",
    flavor: "openai",
    hint: 'Settings → Connections → OpenAI API → URL = {BASE}/v1, Key = {KEY}',
  },
  {
    id: "continue",
    name: "Continue.dev (VSCode/JetBrains)",
    flavor: "openai",
    hint: 'config.json → models[].provider: "openai", apiBase: "{BASE}/v1", apiKey: "{KEY}"',
  },
  {
    id: "curl",
    name: "cURL / Postman / Other",
    flavor: "openai",
    hint: "Gọi trực tiếp endpoint. Xem snippet cURL ở dưới.",
  },
];

export function ThirdPartySetupCard({ keyItem, models, baseUrl, revealed }: Props) {
  const [presetId, setPresetId] = useState<string>("claude-sdk");
  const [showKey, setShowKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState("");

  const autoFullKey = revealed?.[keyItem.id] ?? "";
  const effectiveKey = revealedKey || autoFullKey;
  const maskedKey = `${keyItem.prefix}...${keyItem.suffix}`;
  const keyToDisplay = effectiveKey || maskedKey;
  const hasFullKey = effectiveKey.startsWith("sk-bee-") && !effectiveKey.includes("...");

  const preset = PRESETS.find((p) => p.id === presetId)!;
  const cleanBase = baseUrl.replace(/\/+$/, "");
  // Beeknoee routes thực tế nằm ở /api/v1/messages và /api/v1/chat/completions.
  // → Anthropic SDK append "/v1/messages" → base phải là "<root>/api".
  // → OpenAI SDK append "/chat/completions" → base phải là "<root>/api/v1".
  const anthropicBase = `${cleanBase}/api`;
  const openaiBase = `${cleanBase}/api/v1`;

  const exampleModel = models[0]?.slug || "claude-sonnet-4-5";

  const envSnippet = useMemo(() => {
    if (!preset.envExample) return "";
    const base = preset.flavor === "anthropic" ? anthropicBase : openaiBase;
    return preset.envExample.replace(/{BASE}/g, base).replace(/{KEY}/g, keyToDisplay);
  }, [preset, anthropicBase, openaiBase, keyToDisplay]);

  const presetHint = preset.hint
    .replace(/{BASE}/g, preset.flavor === "anthropic" ? anthropicBase : cleanBase)
    .replace(/{KEY}/g, keyToDisplay);

  const curlAnthropic = `curl ${anthropicBase}/v1/messages \\
  -H "x-api-key: ${keyToDisplay}" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "${exampleModel}",
    "max_tokens": 1024,
    "messages": [{"role":"user","content":"hi"}]
  }'`;

  const curlOpenai = `curl ${openaiBase}/chat/completions \\
  -H "Authorization: Bearer ${keyToDisplay}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${exampleModel}",
    "messages": [{"role":"user","content":"hi"}]
  }'`;

  return (
    <div className="space-y-5">
      {/* Hint */}
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 flex items-start gap-2 text-sm text-ink-100/85">
        <Sparkles size={14} className="text-sky-300 mt-0.5 shrink-0" />
        <span className="flex-1">
          Dùng để kết nối các ứng dụng / SDK bên thứ ba (Claude SDK, Cline, Cherry Studio, LobeChat, Open WebUI, Continue, Cursor...).
          Beeknoee hỗ trợ <b>cả 2 chuẩn</b>: Anthropic Messages API và OpenAI-compatible Chat Completions.
        </span>
      </div>

      {/* Base URLs */}
      <div className="grid md:grid-cols-2 gap-3">
        <BaseUrlCard
          title="Anthropic / Claude SDK"
          subtitle="dùng cho Claude SDK, Cline, Roo Code, ..."
          endpoint="POST /v1/messages"
          baseUrl={anthropicBase}
          flavor="anthropic"
        />
        <BaseUrlCard
          title="OpenAI Compatible"
          subtitle="dùng cho Cursor, Cherry Studio, LobeChat, ..."
          endpoint="POST /chat/completions"
          baseUrl={openaiBase}
          flavor="openai"
        />
      </div>

      {/* API Key */}
      <div>
        <p className="text-[10px] tracking-wider text-ink-200/55 mb-1.5 font-mono uppercase flex items-center gap-1.5">
          <Key size={11} /> API KEY
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 input font-mono text-xs overflow-x-auto whitespace-nowrap">
            {showKey || effectiveKey ? keyToDisplay : maskedKey}
          </code>
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="p-2 rounded-lg border border-white/10 bg-ink-950/60 text-ink-200/70 hover:text-white hover:border-white/20 transition"
            title={showKey ? "Ẩn" : "Hiện"}
          >
            {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <CopyButton text={keyToDisplay} />
        </div>
        {!hasFullKey && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-honey-300 flex-wrap">
            <AlertTriangle size={11} />
            <span>Đang hiển thị key rút gọn. Dán key đầy đủ (sk-bee-...) bạn đã lưu lúc tạo để các snippet chạy được:</span>
            <input
              placeholder="sk-bee-..."
              value={revealedKey}
              onChange={(e) => setRevealedKey(e.target.value)}
              className="input text-xs font-mono w-full mt-1"
            />
          </div>
        )}
      </div>

      {/* Preset selector */}
      <div>
        <p className="text-[10px] tracking-wider text-ink-200/55 mb-1.5 font-mono uppercase flex items-center gap-1.5">
          <Box size={11} /> CHỌN ỨNG DỤNG
        </p>
        <select
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
          className="input w-full text-sm"
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.flavor === "anthropic" ? "· Anthropic-style" : "· OpenAI-style"}
            </option>
          ))}
        </select>

        <div className="mt-3 rounded-xl border border-white/10 bg-ink-950/40 px-4 py-3 text-sm text-ink-100/85">
          <p className="text-[10px] tracking-wider text-ink-200/55 font-mono uppercase mb-1.5">HƯỚNG DẪN</p>
          <p>{presetHint}</p>
        </div>

        {envSnippet && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] tracking-wider text-emerald-300/90 font-mono uppercase">ENV (.env hoặc shell)</p>
              <CopyButton text={envSnippet} />
            </div>
            <pre className="text-xs p-4 rounded-xl border border-white/10 bg-black/40 overflow-x-auto whitespace-pre-wrap break-all"><code>{envSnippet}</code></pre>
          </div>
        )}
      </div>

      {/* cURL snippets */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-wider text-ink-200/55 font-mono uppercase">VÍ DỤ CURL</p>
        {preset.flavor === "anthropic" ? (
          <CurlBlock label="Anthropic Messages" content={curlAnthropic} />
        ) : (
          <CurlBlock label="OpenAI Chat Completions" content={curlOpenai} />
        )}
      </div>

      {/* Models hint */}
      <div className="rounded-xl border border-honey-500/20 bg-honey-500/5 px-4 py-3 text-xs text-ink-100/85">
        <p className="font-semibold flex items-center gap-1.5 mb-2 text-honey-200">
          <Sparkles size={12} /> LƯU Ý
        </p>
        <ul className="space-y-1 list-disc pl-5">
          <li>
            Key này phải được <b>kích hoạt</b> cho model bạn muốn dùng (tab <b>Models</b> ở trên).
          </li>
          <li>
            Dùng <code className="px-1 py-0.5 rounded bg-black/40 border border-white/10 font-mono">slug</code> của
            model làm tham số <code className="px-1 py-0.5 rounded bg-black/40 border border-white/10 font-mono">model</code>{" "}
            khi gọi API. Xem danh sách slug trong tab Models hoặc trang <a href="/models" className="text-sky-300 hover:underline">/models</a>.
          </li>
          <li>Rate limit: 60 req/phút/key. Hết quota sẽ trả 429.</li>
        </ul>
      </div>
    </div>
  );
}

function BaseUrlCard({
  title,
  subtitle,
  endpoint,
  baseUrl,
  flavor,
}: {
  title: string;
  subtitle: string;
  endpoint: string;
  baseUrl: string;
  flavor: Flavor;
}) {
  const badge =
    flavor === "anthropic"
      ? "bg-orange-500/15 text-orange-300 border-orange-500/25"
      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  return (
    <div className="rounded-xl border border-white/10 bg-ink-950/40 px-4 py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Globe size={13} className="text-ink-200/60" />
        <p className="font-semibold text-sm">{title}</p>
        <span className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded border ${badge}`}>
          {flavor === "anthropic" ? "Anthropic" : "OpenAI"}
        </span>
      </div>
      <p className="text-[11px] text-ink-200/55 mb-2">{subtitle}</p>
      <p className="text-[10px] tracking-wider text-ink-200/55 font-mono uppercase mb-1">BASE URL</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 input font-mono text-xs overflow-x-auto whitespace-nowrap">{baseUrl}</code>
        <CopyButton text={baseUrl} />
      </div>
      <p className="mt-2 text-[10px] font-mono text-ink-200/45">
        Endpoint: <span className="text-ink-200/70">{endpoint}</span>
      </p>
    </div>
  );
}

function CurlBlock({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] tracking-wider text-emerald-300/90 font-mono uppercase">{label}</p>
        <CopyButton text={content} />
      </div>
      <pre className="text-xs p-4 rounded-xl border border-white/10 bg-black/40 overflow-x-auto whitespace-pre-wrap break-all"><code>{content}</code></pre>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-2 rounded-lg border border-white/10 bg-ink-950/60 text-ink-200/70 hover:text-white hover:border-white/20 transition shrink-0"
      title="Copy"
    >
      {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
    </button>
  );
}
