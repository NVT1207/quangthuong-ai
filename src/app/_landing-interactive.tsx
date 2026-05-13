"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const BASE_URL = "https://quangthuong-ai.vercel.app/api/v1";

const CODE_SAMPLES = {
  python: `from openai import OpenAI

client = OpenAI(
    api_key="sk-bee-YOUR_API_KEY",
    base_url="${BASE_URL}"  # ← chỉ thay dòng này
)

response = client.chat.completions.create(
    model="claude-sonnet-4-6",
    messages=[
        {"role": "user", "content": "Xin chào!"}
    ]
)

print(response.choices[0].message.content)`,
  node: `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "sk-bee-YOUR_API_KEY",
  baseURL: "${BASE_URL}" // ← chỉ thay dòng này
});

const response = await client.chat.completions.create({
  model: "claude-sonnet-4-6",
  messages: [
    { role: "user", content: "Xin chào!" }
  ]
});

console.log(response.choices[0].message.content);`,
  curl: `curl ${BASE_URL}/chat/completions \\
  -H "Authorization: Bearer sk-bee-YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-6",
    "messages": [{"role": "user", "content": "Xin chào!"}]
  }'`,
};

type Tab = "python" | "node" | "curl";

export function CodeTabs() {
  const [tab, setTab] = useState<Tab>("python");
  const tabs: { id: Tab; label: string }[] = [
    { id: "python", label: "Python" },
    { id: "node", label: "Node.js" },
    { id: "curl", label: "cURL" },
  ];

  return (
    <div className="rounded-2xl overflow-hidden bg-slate-900 shadow-2xl shadow-slate-900/20 border border-slate-800">
      <div className="flex border-b border-slate-800 bg-slate-950/80">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === t.id
                ? "text-white border-b-2 border-honey-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <pre className="p-6 text-sm text-slate-200 overflow-x-auto leading-relaxed">
        <code>{CODE_SAMPLES[tab]}</code>
      </pre>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    q: "API Key có dùng được với OpenAI SDK không?",
    a: `Có. QUANGTHUONG AI tương thích hoàn toàn với OpenAI SDK. Chỉ cần đổi base_url thành "${BASE_URL}" và dùng API key bắt đầu bằng sk-bee-. Không cần sửa logic code.`,
  },
  {
    q: "Có model nào miễn phí không?",
    a: "Không. Tất cả model đều tính theo token thực tế sử dụng. Tuy nhiên giá đã được tối ưu so với mua trực tiếp từ OpenAI/Anthropic, và bạn thanh toán bằng VND qua chuyển khoản ngân hàng — không cần thẻ quốc tế.",
  },
  {
    q: "Nạp tiền tối thiểu bao nhiêu?",
    a: "Tối thiểu 20.000₫ mỗi lần nạp. Hỗ trợ chuyển khoản ngân hàng nội địa và MoMo. Sau khi chuyển khoản, admin xác nhận và cộng tiền tự động trong 1-5 phút.",
  },
  {
    q: "Có hỗ trợ streaming không?",
    a: 'Có. Đặt "stream": true trong request — y hệt cách dùng OpenAI SDK. Hỗ trợ đầy đủ cả Anthropic Messages API (event-stream format) và OpenAI Chat Completions (data: format).',
  },
  {
    q: "QUANGTHUONG AI có an toàn không?",
    a: "API key lưu hash bcrypt, không thể giải ngược. Không lưu nội dung prompt/response sau khi xử lý — chỉ giữ metadata (token count, cost, status). Rate limit 60 requests/phút/key chống abuse.",
  },
];

export function FaqAccordion() {
  const [open, setOpen] = useState(0);
  return (
    <div className="divide-y divide-white/5">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="w-full py-6 flex items-center justify-between text-left group"
            >
              <span className="flex items-center gap-6">
                <span className="text-sm font-mono text-honey-400/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-lg font-semibold text-white group-hover:text-honey-200 transition">
                  {item.q}
                </span>
              </span>
              <ChevronDown
                size={20}
                className={`text-ink-200/50 transition-transform ${
                  isOpen ? "rotate-180 text-honey-400" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div className="pb-6 pl-16 pr-8 text-ink-200/70 leading-relaxed max-w-3xl">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
