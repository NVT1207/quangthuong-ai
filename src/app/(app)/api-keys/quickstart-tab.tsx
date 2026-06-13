"use client";
import { useMemo, useState } from "react";
import { Copy, Check, Rocket, Terminal, AlertTriangle, Key } from "lucide-react";
import type { KeyItem, ModelOpt } from "./cli-panels";

type Lang = "curl" | "python" | "node" | "anthropic";

const LANGS: { id: Lang; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "python", label: "Python" },
  { id: "node", label: "Node.js" },
  { id: "anthropic", label: "Anthropic SDK" },
];

export function QuickStartTab({
  keyItem,
  models,
  baseUrl,
  revealed,
}: {
  keyItem: KeyItem;
  models: ModelOpt[];
  baseUrl: string;
  revealed?: Record<string, string>;
}) {
  const [lang, setLang] = useState<Lang>("curl");
  const [model, setModel] = useState(models[0]?.slug ?? "claude-sonnet-4-5-20251001");
  const [pasted, setPasted] = useState("");

  // base URL chuẩn OpenAI-compatible: {baseUrl}/v1
  const openaiBase = `${baseUrl.replace(/\/$/, "")}/v1`;
  const fullKey = pasted || revealed?.[keyItem.id] || "";
  const hasFull = fullKey.startsWith("sk-bee-") && !fullKey.includes("...");
  const key = hasFull ? fullKey : `${keyItem.prefix}...${keyItem.suffix}`;

  const snippet = useMemo(() => buildSnippet(lang, openaiBase, key, model), [lang, openaiBase, key, model]);

  return (
    <div className="space-y-5">
      <Hint>
        Gọi API tương thích OpenAI/Anthropic chỉ với <b>Base URL</b> + <b>API key</b> này. Chọn ngôn ngữ và model rồi copy đoạn code.
      </Hint>

      {/* Base URL + Key */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="BASE URL (OpenAI-compatible)" value={openaiBase} />
        <div>
          <p className="text-[10px] tracking-wider text-ink-200/55 mb-1.5 font-mono uppercase flex items-center gap-1.5">
            <Key size={11} /> API KEY
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 input font-mono text-xs overflow-x-auto whitespace-nowrap">{key}</code>
            <CopyBtn text={key} />
          </div>
          {!hasFull && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-honey-300">
              <AlertTriangle size={11} className="shrink-0" />
              <span>Code đang dùng key rút gọn. Dán key đầy đủ để chạy được:</span>
            </div>
          )}
          {!hasFull && (
            <input
              placeholder="sk-bee-..."
              onChange={(e) => setPasted(e.target.value.trim())}
              className="input text-xs font-mono w-full mt-1.5"
            />
          )}
        </div>
      </div>

      {/* Model */}
      <div>
        <p className="text-[10px] tracking-wider text-ink-200/55 mb-1.5 font-mono uppercase">MODEL</p>
        <select value={model} onChange={(e) => setModel(e.target.value)} className="input w-full text-sm">
          {models.length === 0 && <option value={model}>{model}</option>}
          {models.map((m) => (
            <option key={m.slug} value={m.slug}>{m.displayName} · {m.provider} · {m.slug}</option>
          ))}
        </select>
      </div>

      {/* Lang tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {LANGS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLang(l.id)}
            className={
              lang === l.id
                ? "px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-sky-400/40 bg-sky-500/15 text-sky-200"
                : "px-3.5 py-1.5 rounded-lg text-xs font-medium border border-white/5 bg-ink-950/40 text-ink-200/65 hover:text-white transition"
            }
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Snippet */}
      <div className="relative rounded-xl border border-white/10 bg-black/40">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
          <span className="text-[10px] tracking-wider text-emerald-300/90 font-mono uppercase flex items-center gap-1.5">
            <Terminal size={12} /> {LANGS.find((l) => l.id === lang)?.label}
          </span>
          <CopyBtn text={snippet} />
        </div>
        <pre className="text-xs p-4 overflow-x-auto whitespace-pre"><code>{snippet}</code></pre>
      </div>
    </div>
  );
}

function buildSnippet(lang: Lang, base: string, key: string, model: string): string {
  if (lang === "curl") {
    return `curl ${base}/chat/completions \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [{"role": "user", "content": "Xin chào!"}]
  }'`;
  }
  if (lang === "python") {
    return `from openai import OpenAI

client = OpenAI(
    base_url="${base}",
    api_key="${key}",
)

resp = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "Xin chào!"}],
)
print(resp.choices[0].message.content)`;
  }
  if (lang === "node") {
    return `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${base}",
  apiKey: "${key}",
});

const resp = await client.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "Xin chào!" }],
});
console.log(resp.choices[0].message.content);`;
  }
  // anthropic
  return `from anthropic import Anthropic

client = Anthropic(
    base_url="${base.replace(/\/v1$/, "")}",
    api_key="${key}",
)

msg = client.messages.create(
    model="${model}",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Xin chào!"}],
)
print(msg.content[0].text)`;
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 flex items-start gap-2 text-sm text-ink-100/85">
      <Rocket size={14} className="text-sky-300 mt-0.5 shrink-0" />
      <span className="flex-1">{children}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-wider text-ink-200/55 mb-1.5 font-mono uppercase">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 input font-mono text-xs overflow-x-auto whitespace-nowrap">{value}</code>
        <CopyBtn text={value} />
      </div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-2 rounded-lg border border-white/10 bg-ink-950/60 text-ink-200/70 hover:text-white hover:border-white/20 transition shrink-0"
      title="Copy"
    >
      {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
    </button>
  );
}
