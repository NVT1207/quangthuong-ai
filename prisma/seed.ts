import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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
  description?: string;
  speedTps?: number;
  latencyMs?: number;
  uptimeStatus?: "good" | "warn" | "down";
  freeDiscount?: number;
  basicDiscount?: number;
  advDiscount?: number;
};

const CATALOG: Seed[] = [
  // ============ TEXT / CHAT ============
  { slug: "claude-haiku-4-5-20251001", displayName: "Claude Haiku 4.5", provider: "anthropic", category: "text",
    inputUSD: 1, outputUSD: 5, contextLength: 200000,
    description: "Phiên bản gọn nhẹ nhất của Claude — nhanh, giá rẻ, đa dụng.",
    speedTps: 95, latencyMs: 420, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", provider: "anthropic", category: "text",
    inputUSD: 3, outputUSD: 15, contextLength: 200000,
    description: "Cân bằng tốc độ và chất lượng — lựa chọn mặc định cho đa số tác vụ.",
    speedTps: 60, latencyMs: 680, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "claude-opus-4-6", displayName: "Claude Opus 4.6", provider: "anthropic", category: "text",
    inputUSD: 15, outputUSD: 75, contextLength: 200000,
    description: "Model lập luận mạnh, dành cho phân tích sâu và sáng tạo phức tạp.",
    speedTps: 32, latencyMs: 1100, uptimeStatus: "good",
    freeDiscount: 40, basicDiscount: 55, advDiscount: 65 },

  { slug: "claude-opus-4-6-thinking", displayName: "Claude Opus 4.6 Thinking", provider: "anthropic", category: "text",
    inputUSD: 15, outputUSD: 75, contextLength: 200000,
    description: "Bật chế độ thinking, lập luận theo từng bước trước khi trả lời.",
    speedTps: 22, latencyMs: 2400, uptimeStatus: "warn",
    freeDiscount: 40, basicDiscount: 55, advDiscount: 65 },

  { slug: "claude-opus-4-7", displayName: "Claude Opus 4.7", provider: "anthropic", category: "text",
    inputUSD: 15, outputUSD: 75, contextLength: 200000,
    description: "Bản cập nhật mới nhất của Opus, cải tiến code và toán.",
    speedTps: 30, latencyMs: 1200, uptimeStatus: "good",
    freeDiscount: 40, basicDiscount: 55, advDiscount: 65 },

  { slug: "claude-opus-4-7-coding", displayName: "Claude Opus 4.7 Coding", provider: "anthropic", category: "text",
    inputUSD: 15, outputUSD: 75, contextLength: 200000,
    description: "Biến thể chuyên cho lập trình, ưu tiên agentic coding.",
    speedTps: 28, latencyMs: 1350, uptimeStatus: "good",
    freeDiscount: 40, basicDiscount: 55, advDiscount: 65 },

  { slug: "gpt-5.5", displayName: "GPT-5.5", provider: "openai", category: "text",
    inputUSD: 2.5, outputUSD: 10, contextLength: 256000,
    description: "Model đa năng mới nhất của OpenAI, tối ưu chi phí.",
    speedTps: 80, latencyMs: 520, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "gpt-5.5-pro", displayName: "GPT-5.5 Pro", provider: "openai", category: "text",
    inputUSD: 10, outputUSD: 40, contextLength: 400000,
    description: "Phiên bản cao cấp, mạnh cho lập luận và tác vụ chuyên sâu.",
    speedTps: 38, latencyMs: 980, uptimeStatus: "good",
    freeDiscount: 40, basicDiscount: 55, advDiscount: 65 },

  { slug: "grok-4-1-fast-non-reasoning", displayName: "Grok 4.1 Fast (Non-Reasoning)", provider: "grok", category: "text",
    inputUSD: 0.2, outputUSD: 0.5, contextLength: 256000,
    description: "Phiên bản Grok 4.1 Fast — trả lời nhanh, không bật reasoning.",
    speedTps: 140, latencyMs: 260, uptimeStatus: "good",
    freeDiscount: 60, basicDiscount: 70, advDiscount: 80 },

  { slug: "grok-4-1-fast-reasoning", displayName: "Grok 4.1 Fast (Reasoning)", provider: "grok", category: "text",
    inputUSD: 0.5, outputUSD: 2, contextLength: 256000,
    description: "Bật reasoning — chậm hơn nhưng chính xác hơn cho bài toán phức tạp.",
    speedTps: 75, latencyMs: 900, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "gemini-2.5-flash-lite", displayName: "Gemini 2.5 Flash Lite", provider: "google", category: "text",
    inputUSD: 0.1, outputUSD: 0.4, contextLength: 1000000,
    description: "Bản nhẹ nhất của Gemini Flash, cực rẻ cho tác vụ đơn giản.",
    speedTps: 180, latencyMs: 220, uptimeStatus: "good",
    freeDiscount: 60, basicDiscount: 70, advDiscount: 80 },

  { slug: "gemini-3.1-flash-lite-preview", displayName: "Gemini 3.1 Flash Lite Preview", provider: "google", category: "text",
    inputUSD: 0.1, outputUSD: 0.4, contextLength: 1000000,
    description: "Preview thế hệ 3.1 — flash-lite, đang trong giai đoạn thử nghiệm.",
    speedTps: 170, latencyMs: 250, uptimeStatus: "warn",
    freeDiscount: 60, basicDiscount: 70, advDiscount: 80 },

  { slug: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", provider: "google", category: "text",
    inputUSD: 0.3, outputUSD: 2.5, contextLength: 1000000,
    description: "Gemini Flash chủ lực — nhanh, đa phương thức, context 1M.",
    speedTps: 130, latencyMs: 320, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "gemini-3-flash", displayName: "Gemini 3 Flash", provider: "google", category: "text",
    inputUSD: 0.5, outputUSD: 3, contextLength: 1000000,
    description: "Thế hệ Gemini 3 Flash — cải tiến chất lượng và đa phương thức.",
    speedTps: 110, latencyMs: 380, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", provider: "google", category: "text",
    inputUSD: 1.25, outputUSD: 10, contextLength: 2000000,
    description: "Gemini Pro — context cực lớn 2M, mạnh cho phân tích tài liệu dài.",
    speedTps: 55, latencyMs: 720, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro Preview", provider: "google", category: "text",
    inputUSD: 2.5, outputUSD: 15, contextLength: 2000000,
    description: "Preview Gemini 3.1 Pro — bản nâng cấp lớn về lập luận.",
    speedTps: 45, latencyMs: 880, uptimeStatus: "warn",
    freeDiscount: 40, basicDiscount: 55, advDiscount: 65 },

  { slug: "deepseek/deepseek-v4-flash", displayName: "DeepSeek V4 Flash", provider: "deepseek", category: "text",
    inputUSD: 0.2, outputUSD: 0.8, contextLength: 128000,
    description: "DeepSeek V4 bản Flash — phản hồi nhanh, giá thấp.",
    speedTps: 160, latencyMs: 280, uptimeStatus: "good",
    freeDiscount: 60, basicDiscount: 70, advDiscount: 80 },

  { slug: "deepseek/deepseek-chat-v3.1", displayName: "DeepSeek V3.1", provider: "deepseek", category: "text",
    inputUSD: 0.27, outputUSD: 1.1, contextLength: 128000,
    description: "DeepSeek V3.1 — model mã nguồn mở mạnh, cân bằng giá/chất lượng.",
    speedTps: 90, latencyMs: 480, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "deepseek/deepseek-v3.2", displayName: "DeepSeek V3.2", provider: "deepseek", category: "text",
    inputUSD: 0.27, outputUSD: 1.1, contextLength: 128000,
    description: "Bản cập nhật V3.2 — cải thiện code và tiếng Việt.",
    speedTps: 95, latencyMs: 450, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "deepseek/deepseek-r1", displayName: "DeepSeek R1", provider: "deepseek", category: "text",
    inputUSD: 0.55, outputUSD: 2.19, contextLength: 128000,
    description: "Reasoning model — bật chain-of-thought, ngang ngửa o1 với giá rẻ.",
    speedTps: 35, latencyMs: 1500, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "deepseek/deepseek-v4-pro", displayName: "DeepSeek V4 Pro", provider: "deepseek", category: "text",
    inputUSD: 1, outputUSD: 4, contextLength: 256000,
    description: "Phiên bản Pro — chất lượng cao nhất của DeepSeek V4.",
    speedTps: 60, latencyMs: 760, uptimeStatus: "good",
    freeDiscount: 40, basicDiscount: 55, advDiscount: 65 },

  // ============ EMBEDDING ============
  { slug: "gemini-embedding-001", displayName: "Gemini Embedding 001", provider: "google", category: "embedding",
    inputUSD: 0.15, outputUSD: 0, contextLength: 2048,
    description: "Embedding model — chuyển text thành vector phục vụ RAG/search.",
    speedTps: 0, latencyMs: 180, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "gemini-embedding-2-preview", displayName: "Gemini Embedding 2 Preview", provider: "google", category: "embedding",
    inputUSD: 0.15, outputUSD: 0, contextLength: 8192,
    description: "Bản preview embedding mới, context dài hơn.",
    speedTps: 0, latencyMs: 210, uptimeStatus: "warn",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "text-embedding-3-small", displayName: "Text Embedding 3 Small", provider: "openai", category: "embedding",
    inputUSD: 0.02, outputUSD: 0, contextLength: 8191,
    description: "Embedding gọn nhẹ của OpenAI — vector 1536 chiều.",
    speedTps: 0, latencyMs: 160, uptimeStatus: "good",
    freeDiscount: 60, basicDiscount: 70, advDiscount: 80 },

  { slug: "text-embedding-3-large", displayName: "Text Embedding 3 Large", provider: "openai", category: "embedding",
    inputUSD: 0.13, outputUSD: 0, contextLength: 8191,
    description: "Embedding chất lượng cao của OpenAI — vector 3072 chiều.",
    speedTps: 0, latencyMs: 240, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  // ============ IMAGE ============
  { slug: "dall-e-3", displayName: "DALL·E 3", provider: "openai", category: "image", priceUnit: "1 ảnh",
    inputUSD: 0.04, outputUSD: 0.04, contextLength: 0,
    description: "Tạo ảnh chất lượng cao từ mô tả văn bản — phiên bản 3 của OpenAI.",
    speedTps: 0, latencyMs: 8000, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 40, advDiscount: 50 },

  { slug: "dall-e-2", displayName: "DALL·E 2", provider: "openai", category: "image", priceUnit: "1 ảnh",
    inputUSD: 0.02, outputUSD: 0.02, contextLength: 0,
    description: "Phiên bản DALL·E 2, giá rẻ hơn DALL·E 3.",
    speedTps: 0, latencyMs: 6500, uptimeStatus: "good",
    freeDiscount: 40, basicDiscount: 50, advDiscount: 60 },

  { slug: "gpt-image-1", displayName: "GPT Image 1", provider: "openai", category: "image", priceUnit: "1 ảnh",
    inputUSD: 0.04, outputUSD: 0.04, contextLength: 0,
    description: "Model tạo ảnh thế hệ mới của OpenAI, bám sát prompt rất tốt.",
    speedTps: 0, latencyMs: 9000, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 40, advDiscount: 50 },

  { slug: "gpt-image-1.5", displayName: "GPT Image 1.5", provider: "openai", category: "image", priceUnit: "1 ảnh",
    inputUSD: 0.05, outputUSD: 0.05, contextLength: 0,
    description: "Bản nâng cấp GPT Image, chất lượng và độ chân thực cao hơn.",
    speedTps: 0, latencyMs: 10000, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 40, advDiscount: 50 },

  { slug: "chatgpt-image-latest", displayName: "ChatGPT Image Latest", provider: "openai", category: "image", priceUnit: "1 ảnh",
    inputUSD: 0.05, outputUSD: 0.05, contextLength: 0,
    description: "Phiên bản mới nhất ChatGPT tích hợp tạo ảnh, dùng cho UX hội thoại.",
    speedTps: 0, latencyMs: 9500, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 40, advDiscount: 50 },

  { slug: "imagen-4.0-generate-001", displayName: "Imagen 4.0", provider: "google", category: "image", priceUnit: "1 ảnh",
    inputUSD: 0.04, outputUSD: 0.04, contextLength: 0,
    description: "Google Imagen 4.0 — model tạo ảnh chất lượng cao của Google.",
    speedTps: 0, latencyMs: 8500, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 40, advDiscount: 50 },

  { slug: "imagen-4.0-fast-generate-001", displayName: "Imagen 4.0 Fast", provider: "google", category: "image", priceUnit: "1 ảnh",
    inputUSD: 0.02, outputUSD: 0.02, contextLength: 0,
    description: "Imagen 4.0 bản Fast — nhanh hơn, giá rẻ hơn.",
    speedTps: 0, latencyMs: 5500, uptimeStatus: "good",
    freeDiscount: 40, basicDiscount: 50, advDiscount: 60 },

  { slug: "imagen-4.0-ultra-generate-001", displayName: "Imagen 4.0 Ultra", provider: "google", category: "image", priceUnit: "1 ảnh",
    inputUSD: 0.06, outputUSD: 0.06, contextLength: 0,
    description: "Imagen 4.0 Ultra — chi tiết cao nhất, dành cho ảnh in lớn.",
    speedTps: 0, latencyMs: 12000, uptimeStatus: "good",
    freeDiscount: 25, basicDiscount: 35, advDiscount: 45 },

  { slug: "gemini-3-pro-image-preview", displayName: "Gemini 3 Pro Image", provider: "google", category: "image", priceUnit: "1 ảnh",
    inputUSD: 0.05, outputUSD: 0.05, contextLength: 0,
    description: "Preview tạo ảnh trong Gemini 3 Pro — hiểu prompt phức tạp tốt.",
    speedTps: 0, latencyMs: 9000, uptimeStatus: "warn",
    freeDiscount: 30, basicDiscount: 40, advDiscount: 50 },

  { slug: "flux-2-pro", displayName: "FLUX 2 Pro", provider: "other", category: "image", priceUnit: "1 ảnh",
    inputUSD: 0.05, outputUSD: 0.05, contextLength: 0,
    description: "FLUX 2 Pro của Black Forest Labs — phong cách nghệ thuật mạnh.",
    speedTps: 0, latencyMs: 9000, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 40, advDiscount: 50 },

  { slug: "seedream-4.5", displayName: "Seedream 4.5", provider: "other", category: "image", priceUnit: "1 ảnh",
    inputUSD: 0.03, outputUSD: 0.03, contextLength: 0,
    description: "Seedream 4.5 của ByteDance — tạo ảnh nhanh, giá rẻ.",
    speedTps: 0, latencyMs: 7000, uptimeStatus: "good",
    freeDiscount: 40, basicDiscount: 50, advDiscount: 60 },

  { slug: "seedream-5-lite", displayName: "Seedream 5 Lite", provider: "other", category: "image", priceUnit: "1 ảnh",
    inputUSD: 0.02, outputUSD: 0.02, contextLength: 0,
    description: "Bản nhẹ của Seedream 5 — phù hợp generate hàng loạt.",
    speedTps: 0, latencyMs: 6000, uptimeStatus: "good",
    freeDiscount: 40, basicDiscount: 50, advDiscount: 60 },

  // ============ VIDEO ============
  { slug: "sora-2", displayName: "Sora 2", provider: "openai", category: "video", priceUnit: "1 giây",
    inputUSD: 0.10, outputUSD: 0.10, contextLength: 0,
    description: "Sora 2 — sinh video chất lượng cao từ văn bản hoặc ảnh.",
    speedTps: 0, latencyMs: 60000, uptimeStatus: "good",
    freeDiscount: 20, basicDiscount: 30, advDiscount: 40 },

  { slug: "sora-2-pro", displayName: "Sora 2 Pro", provider: "openai", category: "video", priceUnit: "1 giây",
    inputUSD: 0.20, outputUSD: 0.20, contextLength: 0,
    description: "Sora 2 Pro — bản cao cấp, video dài và chi tiết hơn.",
    speedTps: 0, latencyMs: 90000, uptimeStatus: "warn",
    freeDiscount: 15, basicDiscount: 25, advDiscount: 35 },

  { slug: "veo-3.1-generate-preview", displayName: "Veo 3.1", provider: "google", category: "video", priceUnit: "1 giây",
    inputUSD: 0.15, outputUSD: 0.15, contextLength: 0,
    description: "Google Veo 3.1 — model sinh video flagship của Google.",
    speedTps: 0, latencyMs: 75000, uptimeStatus: "good",
    freeDiscount: 20, basicDiscount: 30, advDiscount: 40 },

  { slug: "veo-3.1-fast-generate-preview", displayName: "Veo 3.1 Fast", provider: "google", category: "video", priceUnit: "1 giây",
    inputUSD: 0.08, outputUSD: 0.08, contextLength: 0,
    description: "Veo 3.1 bản Fast — nhanh hơn, giá thấp hơn.",
    speedTps: 0, latencyMs: 45000, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 40, advDiscount: 50 },

  { slug: "kling-3.0-std", displayName: "Kling 3.0 Standard", provider: "other", category: "video", priceUnit: "1 giây",
    inputUSD: 0.05, outputUSD: 0.05, contextLength: 0,
    description: "Kling 3.0 Standard — generate video 720p, giá rẻ.",
    speedTps: 0, latencyMs: 50000, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 40, advDiscount: 50 },

  { slug: "kling-3.0-pro", displayName: "Kling 3.0 Pro", provider: "other", category: "video", priceUnit: "1 giây",
    inputUSD: 0.08, outputUSD: 0.08, contextLength: 0,
    description: "Kling 3.0 Pro — 1080p, chuyển động mượt hơn.",
    speedTps: 0, latencyMs: 70000, uptimeStatus: "good",
    freeDiscount: 25, basicDiscount: 35, advDiscount: 45 },

  { slug: "kling-3.0-4k", displayName: "Kling 3.0 4K", provider: "other", category: "video", priceUnit: "1 giây",
    inputUSD: 0.15, outputUSD: 0.15, contextLength: 0,
    description: "Kling 3.0 4K — độ phân giải cao nhất, chuyên cho thương mại.",
    speedTps: 0, latencyMs: 120000, uptimeStatus: "warn",
    freeDiscount: 20, basicDiscount: 30, advDiscount: 40 },

  { slug: "seedance-2-pro", displayName: "Seedance 2 Pro", provider: "other", category: "video", priceUnit: "1 giây",
    inputUSD: 0.10, outputUSD: 0.10, contextLength: 0,
    description: "Seedance 2 Pro — chuyên cho video chuyển động và dance.",
    speedTps: 0, latencyMs: 80000, uptimeStatus: "good",
    freeDiscount: 25, basicDiscount: 35, advDiscount: 45 },

  { slug: "seedance-2-fast", displayName: "Seedance 2 Fast", provider: "other", category: "video", priceUnit: "1 giây",
    inputUSD: 0.05, outputUSD: 0.05, contextLength: 0,
    description: "Seedance 2 Fast — nhanh, giá rẻ, phù hợp prototype.",
    speedTps: 0, latencyMs: 40000, uptimeStatus: "good",
    freeDiscount: 35, basicDiscount: 45, advDiscount: 55 },

  // ============ TTS ============
  { slug: "openai/tts-1", displayName: "OpenAI TTS-1", provider: "openai", category: "tts", priceUnit: "1M ký tự",
    inputUSD: 15, outputUSD: 0, contextLength: 0,
    description: "Text-to-Speech của OpenAI — giọng nói tự nhiên, đa ngôn ngữ.",
    speedTps: 0, latencyMs: 800, uptimeStatus: "good",
    freeDiscount: 40, basicDiscount: 50, advDiscount: 60 },

  { slug: "openai/tts-1-hd", displayName: "OpenAI TTS-1 HD", provider: "openai", category: "tts", priceUnit: "1M ký tự",
    inputUSD: 30, outputUSD: 0, contextLength: 0,
    description: "TTS-1 HD — chất lượng cao hơn, ít méo tiếng.",
    speedTps: 0, latencyMs: 1100, uptimeStatus: "good",
    freeDiscount: 30, basicDiscount: 40, advDiscount: 50 },

  { slug: "openai/gpt-4o-mini-tts", displayName: "GPT-4o Mini TTS", provider: "openai", category: "tts", priceUnit: "1M ký tự",
    inputUSD: 12, outputUSD: 0, contextLength: 0,
    description: "TTS dựa trên GPT-4o mini — biểu cảm và tự nhiên hơn TTS-1.",
    speedTps: 0, latencyMs: 900, uptimeStatus: "good",
    freeDiscount: 40, basicDiscount: 50, advDiscount: 60 },

  { slug: "google/google-tts", displayName: "Google TTS Standard", provider: "google", category: "tts", priceUnit: "1M ký tự",
    inputUSD: 4, outputUSD: 0, contextLength: 0,
    description: "Google Cloud TTS bản Standard — giá rẻ, đầy đủ ngôn ngữ.",
    speedTps: 0, latencyMs: 600, uptimeStatus: "good",
    freeDiscount: 50, basicDiscount: 60, advDiscount: 70 },

  { slug: "google/wavenet", displayName: "Google WaveNet", provider: "google", category: "tts", priceUnit: "1M ký tự",
    inputUSD: 16, outputUSD: 0, contextLength: 0,
    description: "Google WaveNet — giọng deep learning tự nhiên cao cấp.",
    speedTps: 0, latencyMs: 900, uptimeStatus: "good",
    freeDiscount: 35, basicDiscount: 45, advDiscount: 55 },

  { slug: "google/neural2", displayName: "Google Neural2", provider: "google", category: "tts", priceUnit: "1M ký tự",
    inputUSD: 16, outputUSD: 0, contextLength: 0,
    description: "Google Neural2 — thế hệ mới sau WaveNet, biểu cảm tốt.",
    speedTps: 0, latencyMs: 850, uptimeStatus: "good",
    freeDiscount: 35, basicDiscount: 45, advDiscount: 55 },

  { slug: "google/chirp3-hd", displayName: "Google Chirp 3 HD", provider: "google", category: "tts", priceUnit: "1M ký tự",
    inputUSD: 20, outputUSD: 0, contextLength: 0,
    description: "Google Chirp 3 HD — TTS đa ngôn ngữ thế hệ mới.",
    speedTps: 0, latencyMs: 1000, uptimeStatus: "warn",
    freeDiscount: 30, basicDiscount: 40, advDiscount: 50 },
];

const POSTS = [
  {
    slug: "ra-mat-quangthuong-ai",
    title: "Ra mắt QUANGTHUONG AI — Cổng API AI cho lập trình viên Việt",
    excerpt: "Chính thức ra mắt nền tảng truy cập API tới hơn 50 model AI hàng đầu, thanh toán VND, tài liệu tiếng Việt.",
    coverEmoji: "🚀",
    tag: "Thông báo",
    content:
      "## Chào mừng các lập trình viên\n\nQUANGTHUONG AI là nền tảng API gateway tập trung mọi model AI hàng đầu vào **một endpoint OpenAI-compatible duy nhất**. Bạn không cần ký hợp đồng với từng provider, không cần thẻ Visa quốc tế — chỉ cần nạp VND và bắt đầu gọi.\n\n### Điểm nổi bật\n\n- 50+ model: Claude, GPT, Gemini, Grok, DeepSeek, Sora, Veo, Kling, Imagen, FLUX, TTS-1...\n- Giá quy đổi VND minh bạch, không phụ phí ẩn\n- Hỗ trợ stream SSE chuẩn OpenAI\n- Dashboard theo dõi token + chi phí realtime\n- Hỗ trợ tiếng Việt 24/7\n\nThử ngay trên Playground hoặc xem tài liệu để tích hợp vào dự án của bạn.",
  },
  {
    slug: "huong-dan-tich-hop-openai-sdk",
    title: "Tích hợp QUANGTHUONG AI vào OpenAI SDK chỉ với 2 dòng code",
    excerpt: "Vì API tương thích OpenAI hoàn toàn, bạn chỉ cần đổi base URL và API key là dùng được mọi model.",
    coverEmoji: "🧩",
    tag: "Hướng dẫn",
    content:
      "## Tương thích chuẩn OpenAI\n\nMọi SDK chính thức của OpenAI (Python, Node.js, Go, Rust...) đều hoạt động ngay với QUANGTHUONG AI. Chỉ cần đổi `base_url` và `api_key`.\n\n```python\nfrom openai import OpenAI\n\nclient = OpenAI(\n    base_url=\"https://quangthuong.ai/api/v1\",\n    api_key=\"sk-bee-...\"  # key tạo trên dashboard\n)\n\nresp = client.chat.completions.create(\n    model=\"claude-sonnet-4-6\",\n    messages=[{\"role\": \"user\", \"content\": \"Xin chào\"}]\n)\nprint(resp.choices[0].message.content)\n```\n\nThay `model` để chuyển sang Gemini, GPT, Grok, DeepSeek... không cần đổi gì khác.",
  },
  {
    slug: "so-sanh-claude-opus-vs-gpt-5-5-pro",
    title: "So sánh Claude Opus 4.7 vs GPT-5.5 Pro: chọn cái nào cho code?",
    excerpt: "Bài đánh giá nhanh về hai model flagship hiện đang được dùng nhiều nhất cho coding agents.",
    coverEmoji: "⚔️",
    tag: "Đánh giá",
    content:
      "## TL;DR\n\n- **Claude Opus 4.7 Coding** thắng về độ chính xác và tuân thủ instruction\n- **GPT-5.5 Pro** thắng về tốc độ phản hồi và đa ngôn ngữ tổng quát\n- Cả hai đều đắt — cân nhắc cache prompt và rotate sang Haiku/Mini cho task đơn giản\n\n### Chi tiết\n\nClaude Opus 4.7 mã coding biến thể chuyên biệt được fine-tune trên hàng triệu agentic traces, làm việc với MCP, tool use chính xác hơn. Giá $15/$75 mỗi 1M token đầu vào/ra.\n\nGPT-5.5 Pro mạnh ở khả năng đa năng và biểu đạt tiếng Anh tự nhiên, latency thấp hơn. Phù hợp khi cần phản hồi nhanh trong production.\n\nCả hai đều có trên QUANGTHUONG AI — bạn có thể A/B test ngay trên Playground.",
  },
];

const CHANGELOG = [
  {
    version: "v0.4.0",
    title: "Bổ sung 4 trang model: Text & Embedding, Image, Video, TTS",
    kind: "feature",
    content: "- Tách catalog theo loại model\n- Thêm 30+ model image/video/tts mới\n- Sidebar restructure theo nhóm Sản phẩm / Quản lý / Tài chính / Thông tin",
  },
  {
    version: "v0.3.0",
    title: "Hệ thống Affiliate, Blog, Hướng dẫn, Changelog",
    kind: "feature",
    content: "- Ra mắt chương trình Affiliate với hoa hồng 10% trọn đời\n- Trang Hướng Dẫn tích hợp đầy đủ ví dụ Python/JS/cURL\n- Blog cập nhật tin tức và case study",
  },
  {
    version: "v0.2.1",
    title: "Tối ưu billing realtime cho stream SSE",
    kind: "improvement",
    content: "- Đếm token chính xác hơn khi upstream không gửi usage\n- Re-fetch balance ngay trước khi trừ tiền, tránh race condition giữa nhiều request",
  },
  {
    version: "v0.2.0",
    title: "Forward upstream Beeknoee — bỏ mock response",
    kind: "feature",
    content: "- Mọi request qua `/api/v1/chat/completions` được forward thật tới Beeknoee gateway\n- Hỗ trợ pass-through các option chuẩn OpenAI: temperature, top_p, max_tokens, stop, response_format, tools, tool_choice",
  },
  {
    version: "v0.1.0",
    title: "Phát hành phiên bản beta đầu tiên",
    kind: "feature",
    content: "- Đăng ký / đăng nhập\n- Tạo API key\n- Playground thử nghiệm model\n- Top-up VND duyệt tay",
  },
];

async function main() {
  const adminPass = await bcrypt.hash("admin123", 10);
  const demoPass = await bcrypt.hash("demo123", 10);

  await prisma.user.upsert({
    where: { email: "admin@beeknoee.local" },
    update: {},
    create: {
      email: "admin@beeknoee.local",
      name: "Quản trị viên",
      passwordHash: adminPass,
      role: "ADMIN",
      balance: 1000000,
    },
  });

  await prisma.user.upsert({
    where: { email: "demo@beeknoee.local" },
    update: {},
    create: {
      email: "demo@beeknoee.local",
      name: "Người dùng demo",
      passwordHash: demoPass,
      role: "USER",
      balance: 100000,
    },
  });

  await prisma.model.deleteMany({});
  for (const m of CATALOG) {
    await prisma.model.create({
      data: {
        slug: m.slug,
        displayName: m.displayName,
        provider: m.provider,
        category: m.category,
        priceUnit: m.priceUnit ?? "1M tokens",
        inputPrice: usd(m.inputUSD),
        outputPrice: usd(m.outputUSD),
        contextLength: m.contextLength,
        description: m.description ?? null,
        speedTps: m.speedTps ?? 0,
        latencyMs: m.latencyMs ?? 0,
        uptimeStatus: m.uptimeStatus ?? "good",
        freeDiscount: m.freeDiscount ?? 0,
        basicDiscount: m.basicDiscount ?? 0,
        advDiscount: m.advDiscount ?? 0,
      },
    });
  }

  await prisma.blogPost.deleteMany({});
  for (const p of POSTS) {
    await prisma.blogPost.create({ data: p });
  }

  await prisma.changelogEntry.deleteMany({});
  for (const c of CHANGELOG) {
    await prisma.changelogEntry.create({ data: c });
  }

  console.log(`Seed xong: ${CATALOG.length} model, ${POSTS.length} bài blog, ${CHANGELOG.length} changelog.`);
  console.log("admin@beeknoee.local / admin123 — demo@beeknoee.local / demo123");
}

main().finally(() => prisma.$disconnect());
