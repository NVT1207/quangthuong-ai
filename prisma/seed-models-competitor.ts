import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const USD_TO_VND = 25000;
const usd = (n: number) => Math.round(n * USD_TO_VND);

type Seed = {
  slug: string;
  displayName: string;
  provider: string;
  category: "text" | "embedding" | "image" | "video" | "tts";
  priceUnit?: string;
  inputUSD: number;
  outputUSD: number;
  contextLength: number;
  description: string;
  speedTps: number;
  latencyMs: number;
  uptimeStatus: "good" | "warn" | "down";
  freeDiscount: number;
  basicDiscount: number;
  advDiscount: number;
};

const CATALOG: Seed[] = [
  // ===== FREE TIER (giá symbolic) =====
  { slug: "glm-4.5-flash", displayName: "GLM-4.5-Flash", provider: "other", category: "text",
    inputUSD: 0.01, outputUSD: 0.02, contextLength: 128000,
    description: "Model văn bản miễn phí phiên bản cũ hơn của Z.AI. Hoàn toàn free, hợp prototype và testing.",
    speedTps: 10, latencyMs: 30800, uptimeStatus: "warn",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "glm-4.7-flash", displayName: "GLM-4.7-Flash", provider: "other", category: "text",
    inputUSD: 0.01, outputUSD: 0.02, contextLength: 128000,
    description: "Model văn bản miễn phí từ Z.AI, phù hợp cho chat và tạo nội dung.",
    speedTps: 15, latencyMs: 34900, uptimeStatus: "warn",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "llama3.1-8b", displayName: "Llama 3.1 8B", provider: "meta", category: "text",
    inputUSD: 0.01, outputUSD: 0.02, contextLength: 128000,
    description: "Meta Llama 3.1 8B chạy trên Cerebras Inference — tốc độ inference cực nhanh.",
    speedTps: 56, latencyMs: 3300, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "qwen-3-235b-a22b-instruct-2507", displayName: "Qwen 3 235B A22B Instruct", provider: "other", category: "text",
    inputUSD: 0.01, outputUSD: 0.02, contextLength: 131072,
    description: "Qwen3-235B-A22B MoE (22B active/235B total) chạy trên Cerebras Inference.",
    speedTps: 80, latencyMs: 6000, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  // ===== TEXT — UNDER $0.50 =====
  { slug: "openai/gpt-oss-120b", displayName: "GPT-OSS 120B", provider: "openai", category: "text",
    inputUSD: 0.05, outputUSD: 0.1, contextLength: 128000,
    description: "Suy luận logic sắc bén, giỏi toán và phân tích chuyên sâu. Tính ~15đ/request.",
    speedTps: 23, latencyMs: 9700, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "gpt-5-nano", displayName: "GPT-5 Nano", provider: "openai", category: "text",
    inputUSD: 0.05, outputUSD: 0.4, contextLength: 400000,
    description: "Model nhỏ nhất và rẻ nhất của GPT-5.",
    speedTps: 19, latencyMs: 5400, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "glm-4.7-flashx", displayName: "GLM-4.7-FlashX", provider: "other", category: "text",
    inputUSD: 0.07, outputUSD: 0.4, contextLength: 131072,
    description: "Phiên bản tốc độ cao của GLM-4.7-Flash. Kiến trúc MoE 30B tham số (3B active).",
    speedTps: 60, latencyMs: 2200, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "gemini-2.5-flash-lite", displayName: "Gemini 2.5 Flash Lite", provider: "google", category: "text",
    inputUSD: 0.1, outputUSD: 0.4, contextLength: 1048576,
    description: "Model rẻ nhất của Gemini 2.5.",
    speedTps: 95, latencyMs: 2600, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "deepseek/deepseek-v4-flash", displayName: "DeepSeek V4 Flash", provider: "deepseek", category: "text",
    inputUSD: 0.14, outputUSD: 0.28, contextLength: 128000,
    description: "Bản nhanh và rẻ của DeepSeek V4, phù hợp chat app, support bot, scale.",
    speedTps: 29, latencyMs: 5100, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "deepseek/deepseek-chat-v3.1", displayName: "DeepSeek V3.1", provider: "deepseek", category: "text",
    inputUSD: 0.15, outputUSD: 0.75, contextLength: 128000,
    description: "Model chat đa năng, hiệu quả chi phí cao.",
    speedTps: 25, latencyMs: 1300, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "gpt-5.4-nano", displayName: "GPT-5.4 Nano", provider: "openai", category: "text",
    inputUSD: 0.2, outputUSD: 1.25, contextLength: 400000,
    description: "Model siêu nhẹ, giá thấp nhất dòng 5.4 — tối ưu cho tác vụ đơn giản, batch lớn.",
    speedTps: 73, latencyMs: 1500, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "grok-4-1-fast-non-reasoning", displayName: "Grok 4.1 Fast (Non-Reasoning)", provider: "grok", category: "text",
    inputUSD: 0.2, outputUSD: 0.5, contextLength: 256000,
    description: "Phiên bản nhanh không reasoning của Grok 4.1, giá cực kỳ cạnh tranh.",
    speedTps: 44, latencyMs: 600, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "grok-4-1-fast-reasoning", displayName: "Grok 4.1 Fast (Reasoning)", provider: "grok", category: "text",
    inputUSD: 0.2, outputUSD: 0.5, contextLength: 256000,
    description: "Model reasoning siêu rẻ của Grok, tốc độ nhanh với chi phí tối ưu.",
    speedTps: 12, latencyMs: 800, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "deepseek/deepseek-v3.2", displayName: "DeepSeek V3.2", provider: "deepseek", category: "text",
    inputUSD: 0.25, outputUSD: 0.42, contextLength: 128000,
    description: "Model mới nhất với sparse attention, giá cực rẻ.",
    speedTps: 30, latencyMs: 4500, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "gemini-3.1-flash-lite-preview", displayName: "Gemini 3.1 Flash Lite Preview", provider: "google", category: "text",
    inputUSD: 0.25, outputUSD: 1.5, contextLength: 1048576,
    description: "Model nhanh và rẻ nhất dòng Gemini 3.1, tối ưu cho tác vụ khối lượng lớn.",
    speedTps: 27, latencyMs: 4300, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "gpt-5-mini", displayName: "GPT-5 Mini", provider: "openai", category: "text",
    inputUSD: 0.25, outputUSD: 2, contextLength: 400000,
    description: "Phiên bản nhỏ gọn của GPT-5.",
    speedTps: 75, latencyMs: 9500, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", provider: "google", category: "text",
    inputUSD: 0.3, outputUSD: 2.5, contextLength: 1048576,
    description: "Model Flash 2.5 cân bằng giá và hiệu năng.",
    speedTps: 27, latencyMs: 9100, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "kr/deepseek-3.2", displayName: "Kiro DeepSeek V3.2", provider: "other", category: "text",
    inputUSD: 0.3, outputUSD: 1.2, contextLength: 128000,
    description: "DeepSeek V3.2 qua Kiro AI — chuyên coding, debugging, system tasks.",
    speedTps: 1, latencyMs: 36900, uptimeStatus: "warn",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "kr/qwen3-coder-next", displayName: "Kiro Qwen3 Coder Next", provider: "other", category: "text",
    inputUSD: 0.3, outputUSD: 1.2, contextLength: 256000,
    description: "Qwen3 Coder Next qua Kiro AI — model mới nhất cho coding tasks.",
    speedTps: 1, latencyMs: 32900, uptimeStatus: "warn",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "minimax/minimax-m2.5", displayName: "MiniMax-M2.5", provider: "other", category: "text",
    inputUSD: 0.3, outputUSD: 1.2, contextLength: 200000,
    description: "Model đa năng thế hệ mới của MiniMax với khả năng coding, reasoning, tool use.",
    speedTps: 24, latencyMs: 45800, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 50, advDiscount: 80 },

  { slug: "minimax/minimax-m2.7", displayName: "MiniMax-M2.7", provider: "other", category: "text",
    inputUSD: 0.3, outputUSD: 1.2, contextLength: 200000,
    description: "Model mạnh của MiniMax, tối ưu agent task, coding, long context.",
    speedTps: 35, latencyMs: 21700, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 40, advDiscount: 50 },

  { slug: "qwen3.5-plus", displayName: "Qwen 3.5 Plus", provider: "other", category: "text",
    inputUSD: 0.4, outputUSD: 2.4, contextLength: 131072,
    description: "Qwen 3.5 Plus — flagship model thế hệ mới nhất của Alibaba Cloud.",
    speedTps: 6, latencyMs: 7300, uptimeStatus: "warn",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "gemini-3-flash", displayName: "Gemini 3 Flash", provider: "google", category: "text",
    inputUSD: 0.5, outputUSD: 3, contextLength: 1048576,
    description: "Model Gemini 3 cân bằng tốc độ và chất lượng.",
    speedTps: 59, latencyMs: 13100, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "kimi-k2.5", displayName: "Kimi K2.5", provider: "other", category: "text",
    inputUSD: 0.6, outputUSD: 3, contextLength: 200000,
    description: "Model Kimi K2.5 với khả năng xử lý context dài, giá hợp lý.",
    speedTps: 25, latencyMs: 11900, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 50, advDiscount: 80 },

  { slug: "deepseek/deepseek-r1", displayName: "DeepSeek R1", provider: "deepseek", category: "text",
    inputUSD: 0.7, outputUSD: 2.5, contextLength: 128000,
    description: "Model reasoning với chain-of-thought mạnh.",
    speedTps: 23, latencyMs: 3900, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  // ===== TEXT — $0.75-$3 =====
  { slug: "openai/gpt-5.4-mini", displayName: "GPT-5.4 Mini (direct)", provider: "openai", category: "text",
    inputUSD: 0.75, outputUSD: 4.5, contextLength: 400000,
    description: "Model nhỏ gọn với hiệu năng cao, giá cực rẻ — phù hợp cho tasks hàng ngày.",
    speedTps: 43, latencyMs: 1600, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "gpt-5.4-mini", displayName: "GPT-5.4 Mini", provider: "openai", category: "text",
    inputUSD: 0.75, outputUSD: 4.5, contextLength: 400000,
    description: "Model nhỏ gọn với hiệu năng cao, giá cực rẻ — phù hợp cho tasks hàng ngày.",
    speedTps: 17, latencyMs: 7100, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 30, advDiscount: 40 },

  { slug: "qwen3-coder-next", displayName: "Qwen3 Coder Next", provider: "other", category: "text",
    inputUSD: 0.75, outputUSD: 2.5, contextLength: 256000,
    description: "Qwen3 Coder Next — mô hình AI lập trình của Alibaba Cloud, cân bằng giá và chất lượng.",
    speedTps: 12, latencyMs: 800, uptimeStatus: "warn",
    freeDiscount: 30, basicDiscount: 50, advDiscount: 80 },

  { slug: "claude-haiku-4-5-20251001", displayName: "Claude Haiku 4.5", provider: "anthropic", category: "text",
    inputUSD: 1, outputUSD: 5, contextLength: 200000,
    description: "Model nhanh nhất và rẻ nhất của Claude.",
    speedTps: 33, latencyMs: 1700, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "anthropic/claude-haiku-4-5-20251001", displayName: "Claude Haiku 4.5 (Anthropic)", provider: "anthropic", category: "text",
    inputUSD: 1, outputUSD: 5, contextLength: 200000,
    description: "Claude Haiku 4.5 — nhanh, rẻ, hiệu quả. Trực tiếp từ Anthropic.",
    speedTps: 26, latencyMs: 1000, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "glm-5", displayName: "GLM-5", provider: "other", category: "text",
    inputUSD: 1, outputUSD: 3.2, contextLength: 128000,
    description: "Model flagship thế hệ mới từ Z.AI, được tối ưu cho reasoning phức tạp.",
    speedTps: 8, latencyMs: 8000, uptimeStatus: "warn",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "kr/claude-haiku-4.5", displayName: "Kiro Claude Haiku 4.5", provider: "other", category: "text",
    inputUSD: 1, outputUSD: 5, contextLength: 200000,
    description: "Claude Haiku 4.5 qua Kiro AI — nhanh, rẻ, coding-focused.",
    speedTps: 6, latencyMs: 28100, uptimeStatus: "warn",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", provider: "google", category: "text",
    inputUSD: 1.25, outputUSD: 10, contextLength: 2097152,
    description: "Model Pro thế hệ 2.5, mạnh về reasoning.",
    speedTps: 29, latencyMs: 12700, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 50, advDiscount: 50 },

  { slug: "gpt-5", displayName: "GPT-5", provider: "openai", category: "text",
    inputUSD: 1.25, outputUSD: 10, contextLength: 400000,
    description: "Model thế hệ GPT-5 cho coding và reasoning.",
    speedTps: 51, latencyMs: 6000, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "deepseek/deepseek-v4-pro", displayName: "DeepSeek V4 Pro", provider: "deepseek", category: "text",
    inputUSD: 1.74, outputUSD: 3.48, contextLength: 128000,
    description: "Bản mạnh nhất dòng V4, reasoning cao, coding mạnh, phù hợp task khó.",
    speedTps: 22, latencyMs: 3900, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "gpt-5.2", displayName: "GPT-5.2", provider: "openai", category: "text",
    inputUSD: 1.75, outputUSD: 14, contextLength: 400000,
    description: "Model flagship mới nhất cho coding và agentic tasks.",
    speedTps: 20, latencyMs: 14100, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "gpt-5.3-codex", displayName: "GPT-5.3 Codex", provider: "openai", category: "text",
    inputUSD: 1.75, outputUSD: 14, contextLength: 400000,
    description: "Model coding mạnh nhất hiện tại, frontier agentic coding với context 400K.",
    speedTps: 4, latencyMs: 16800, uptimeStatus: "warn",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro Preview", provider: "google", category: "text",
    inputUSD: 2, outputUSD: 12, contextLength: 2097152,
    description: "Gemini 3.1 Pro Preview — phiên bản preview mới nhất.",
    speedTps: 6, latencyMs: 7300, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "openai/gpt-5.4", displayName: "GPT-5.4 (direct)", provider: "openai", category: "text",
    inputUSD: 2.5, outputUSD: 15, contextLength: 400000,
    description: "Mô hình flagship mới nhất của OpenAI, hợp nhất dòng GPT và Codex.",
    speedTps: 52, latencyMs: 5500, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "gpt-5.4", displayName: "GPT-5.4", provider: "openai", category: "text",
    inputUSD: 2.5, outputUSD: 15, contextLength: 400000,
    description: "Mô hình flagship mới nhất của OpenAI, hợp nhất dòng GPT và Codex.",
    speedTps: 25, latencyMs: 11900, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", provider: "anthropic", category: "text",
    inputUSD: 3, outputUSD: 15, contextLength: 200000,
    description: "Model cân bằng giữa giá và hiệu năng.",
    speedTps: 17, latencyMs: 22100, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "anthropic/claude-sonnet-4-6", displayName: "Claude Sonnet 4.6 (Anthropic)", provider: "anthropic", category: "text",
    inputUSD: 3, outputUSD: 15, contextLength: 200000,
    description: "Claude Sonnet 4.6 — trực tiếp từ Anthropic. Mô hình cân bằng giữa hiệu năng.",
    speedTps: 55, latencyMs: 1800, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  // ===== TEXT — $5+ =====
  { slug: "claude-opus-4-6", displayName: "Claude Opus 4.6", provider: "anthropic", category: "text",
    inputUSD: 5, outputUSD: 25, contextLength: 200000,
    description: "Model mạnh nhất của Claude, xuất sắc về coding.",
    speedTps: 25, latencyMs: 4400, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "claude-opus-4-6-thinking", displayName: "Claude Opus 4.6 Thinking", provider: "anthropic", category: "text",
    inputUSD: 5, outputUSD: 25, contextLength: 200000,
    description: "Model mạnh nhất của Claude, xuất sắc về coding.",
    speedTps: 11, latencyMs: 21800, uptimeStatus: "warn",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "claude-opus-4-7", displayName: "Claude Opus 4.7", provider: "anthropic", category: "text",
    inputUSD: 5, outputUSD: 25, contextLength: 200000,
    description: "Model flagship mới nhất của Anthropic, xuất sắc mọi tác vụ: coding, reasoning, viết.",
    speedTps: 24, latencyMs: 15100, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 40, advDiscount: 50 },

  { slug: "anthropic/claude-opus-4-7", displayName: "Claude Opus 4.7 (Anthropic)", provider: "anthropic", category: "text",
    inputUSD: 5, outputUSD: 25, contextLength: 200000,
    description: "Claude Opus 4.7 — mô hình mạnh nhất của Anthropic. Trực tiếp từ nhà sản xuất.",
    speedTps: 5, latencyMs: 1900, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "claude-opus-4-7-coding", displayName: "Claude Opus 4.7 Coding", provider: "anthropic", category: "text",
    inputUSD: 5, outputUSD: 25, contextLength: 200000,
    description: "Model chuyên biệt cho lập trình từ Anthropic. Tối ưu hóa cho sinh code, debugging.",
    speedTps: 5, latencyMs: 6400, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 40, advDiscount: 50 },

  { slug: "gpt-5.5", displayName: "GPT-5.5", provider: "openai", category: "text",
    inputUSD: 5, outputUSD: 30, contextLength: 400000,
    description: "Model frontier mới nhất của OpenAI, hỗ trợ reasoning với nhiều mức.",
    speedTps: 6, latencyMs: 28100, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 30, advDiscount: 40 },

  { slug: "openai/gpt-5.5", displayName: "GPT-5.5 (direct)", provider: "openai", category: "text",
    inputUSD: 5, outputUSD: 30, contextLength: 400000,
    description: "Model frontier mới nhất của OpenAI, hỗ trợ reasoning với nhiều mức.",
    speedTps: 69, latencyMs: 8300, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "kr/claude-sonnet-4.5", displayName: "Kiro Claude Sonnet 4.5", provider: "other", category: "text",
    inputUSD: 5, outputUSD: 20, contextLength: 200000,
    description: "Claude Sonnet 4.5 qua Kiro AI — coding-focused với Kiro personality.",
    speedTps: 1, latencyMs: 22500, uptimeStatus: "warn",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "gpt-5.5-pro", displayName: "GPT-5.5 Pro", provider: "openai", category: "text",
    inputUSD: 30, outputUSD: 180, contextLength: 400000,
    description: "Model cao cấp nhất của OpenAI, sử dụng nhiều compute hơn để suy nghĩ sâu.",
    speedTps: 0, latencyMs: 0, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },

  { slug: "openai/gpt-5.5-pro", displayName: "GPT-5.5 Pro (direct)", provider: "openai", category: "text",
    inputUSD: 30, outputUSD: 180, contextLength: 400000,
    description: "Model cao cấp nhất của OpenAI, sử dụng nhiều compute hơn để suy nghĩ sâu.",
    speedTps: 0, latencyMs: 0, uptimeStatus: "good",
    freeDiscount: 0, basicDiscount: 0, advDiscount: 0 },
];

async function main() {
  let created = 0;
  let updated = 0;
  for (const m of CATALOG) {
    const existing = await prisma.model.findUnique({ where: { slug: m.slug } });
    const data = {
      slug: m.slug,
      displayName: m.displayName,
      provider: m.provider,
      category: m.category,
      priceUnit: m.priceUnit ?? "1M tokens",
      inputPrice: usd(m.inputUSD),
      outputPrice: usd(m.outputUSD),
      contextLength: m.contextLength,
      description: m.description,
      speedTps: m.speedTps,
      latencyMs: m.latencyMs,
      uptimeStatus: m.uptimeStatus,
      freeDiscount: m.freeDiscount,
      basicDiscount: m.basicDiscount,
      advDiscount: m.advDiscount,
      active: true,
    };
    await prisma.model.upsert({
      where: { slug: m.slug },
      update: data,
      create: data,
    });
    if (existing) updated++;
    else created++;
  }
  console.log(`Done. ${created} created, ${updated} updated. Total in catalog: ${CATALOG.length}`);
  const total = await prisma.model.count();
  console.log(`Models in DB now: ${total}`);
}

main().finally(() => prisma.$disconnect());
