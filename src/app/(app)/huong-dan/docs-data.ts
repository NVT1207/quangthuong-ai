export type DocSection = {
  slug: string;
  title: string;
  emoji: string;
  summary: string;
  content: string;
};

export const DOCS_SECTIONS: DocSection[] = [
  {
    slug: "bat-dau",
    title: "Bắt đầu nhanh",
    emoji: "🚀",
    summary: "Đăng ký, tạo API key và gọi request đầu tiên trong vòng 1 phút.",
    content: `## Tổng quan

QUANGTHUONG AI là một API gateway tương thích chuẩn OpenAI. Bạn dùng được mọi model (Claude, GPT, Gemini, Grok, DeepSeek, Sora, Veo, Imagen, FLUX, TTS...) qua **cùng một endpoint**.

### Endpoint chính

\`\`\`
https://quangthuong.ai/api/v1
\`\`\`

### Authentication

Gửi API key qua header \`Authorization: Bearer sk-bee-...\`. Tạo key trong dashboard tại mục **API Keys**.

> Key đầy đủ chỉ hiển thị **một lần** khi tạo. Lưu vào nơi an toàn (\`.env\`, secret manager). Nếu mất, hãy revoke và tạo lại.

### Gọi thử bằng cURL

\`\`\`bash
curl https://quangthuong.ai/api/v1/chat/completions \\
  -H "Authorization: Bearer sk-bee-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-6",
    "messages": [{"role": "user", "content": "Xin chào"}]
  }'
\`\`\`

### Test trực tiếp trên dashboard

Vào **Playground** để gửi request thử nghiệm mà không cần code — tốt cho việc so sánh chất lượng giữa các model.`,
  },
  {
    slug: "python-sdk",
    title: "Tích hợp Python (OpenAI SDK)",
    emoji: "🐍",
    summary: "Dùng thư viện chính thức của OpenAI để gọi tới mọi model qua QUANGTHUONG AI.",
    content: `## Cài đặt

\`\`\`bash
pip install openai
\`\`\`

## Cấu hình client

\`\`\`python
from openai import OpenAI

client = OpenAI(
    base_url="https://quangthuong.ai/api/v1",
    api_key="sk-bee-..."  # key tạo trên dashboard
)
\`\`\`

## Chat completion

\`\`\`python
resp = client.chat.completions.create(
    model="claude-sonnet-4-6",
    messages=[
        {"role": "system", "content": "Bạn là trợ lý lập trình."},
        {"role": "user", "content": "Viết hàm tính fibonacci bằng Python."}
    ],
    temperature=0.2,
    max_tokens=500,
)
print(resp.choices[0].message.content)
print("Cost:", resp.usage)
\`\`\`

## Streaming

\`\`\`python
stream = client.chat.completions.create(
    model="gpt-5-pro",
    messages=[{"role": "user", "content": "Kể về vũ trụ"}],
    stream=True,
)
for chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta:
        print(delta, end="", flush=True)
\`\`\`

## Embedding

\`\`\`python
emb = client.embeddings.create(
    model="text-embedding-3-large",
    input=["Câu thứ nhất", "Câu thứ hai"]
)
print(len(emb.data), "vectors,", len(emb.data[0].embedding), "chiều")
\`\`\``,
  },
  {
    slug: "nodejs-sdk",
    title: "Tích hợp Node.js / TypeScript",
    emoji: "🟢",
    summary: "Dùng \`openai\` package trên Node — hoạt động cho cả Next.js, Express, Bun.",
    content: `## Cài đặt

\`\`\`bash
npm install openai
\`\`\`

## Cấu hình client

\`\`\`ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://quangthuong.ai/api/v1",
  apiKey: process.env.QUANGTHUONG_API_KEY!,
});
\`\`\`

## Chat completion

\`\`\`ts
const resp = await client.chat.completions.create({
  model: "gemini-2.5-pro",
  messages: [
    { role: "system", content: "Trả lời ngắn gọn, súc tích." },
    { role: "user", content: "Việt Nam có bao nhiêu tỉnh?" },
  ],
});
console.log(resp.choices[0].message.content);
\`\`\`

## Streaming SSE

\`\`\`ts
const stream = await client.chat.completions.create({
  model: "claude-sonnet-4-6",
  messages: [{ role: "user", content: "Viết bài thơ ngắn về biển" }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
\`\`\`

## Dùng trong Next.js Server Action

\`\`\`ts
"use server";
import OpenAI from "openai";

export async function askAI(prompt: string) {
  const client = new OpenAI({
    baseURL: "https://quangthuong.ai/api/v1",
    apiKey: process.env.QUANGTHUONG_API_KEY!,
  });
  const r = await client.chat.completions.create({
    model: "claude-haiku-4-5-20251001",
    messages: [{ role: "user", content: prompt }],
  });
  return r.choices[0].message.content;
}
\`\`\``,
  },
  {
    slug: "image-generation",
    title: "Sinh ảnh (Image Generation)",
    emoji: "🎨",
    summary: "Gọi các model DALL-E, Imagen, FLUX, Seedream để sinh ảnh từ prompt.",
    content: `## Endpoint

\`\`\`
POST https://quangthuong.ai/api/v1/images/generations
\`\`\`

Tương thích chuẩn OpenAI Images API.

## Ví dụ Python

\`\`\`python
from openai import OpenAI

client = OpenAI(base_url="https://quangthuong.ai/api/v1", api_key="sk-bee-...")

img = client.images.generate(
    model="dall-e-3",
    prompt="Một con ong vàng đang nhảy múa trên bông hoa hướng dương, kiểu pixel art",
    size="1024x1024",
    n=1,
)
print(img.data[0].url)
\`\`\`

## Các model nổi bật

- **dall-e-3** — chất lượng phổ thông, ổn định, hiểu prompt tiếng Việt tốt
- **gpt-image-1.5** — model mới của OpenAI, sinh ảnh từ ảnh tham chiếu
- **imagen-4.0-ultra-generate-001** — flagship của Google, độ chân thực cao
- **flux-2-pro** — sắc nét, phong cách cinematic
- **seedream-5-lite** — rẻ và rất nhanh, hợp khi cần preview hàng loạt

## Tính giá

Image model tính theo **₫ / 1 ảnh** thay vì token. Xem giá trực tiếp ở trang **Image Models**.`,
  },
  {
    slug: "video-generation",
    title: "Sinh video (Sora, Veo, Kling, Seedance)",
    emoji: "🎬",
    summary: "Tạo video từ text hoặc ảnh — workflow batch và polling job.",
    content: `## Endpoint

\`\`\`
POST https://quangthuong.ai/api/v1/videos
\`\`\`

Video render mất từ 30s đến vài phút. API trả về \`job_id\` ngay, sau đó bạn poll trạng thái.

## Tạo job

\`\`\`bash
curl https://quangthuong.ai/api/v1/videos \\
  -H "Authorization: Bearer sk-bee-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "sora-2",
    "prompt": "Một con mèo Việt Nam đi bộ trên phố Hà Nội mưa nhỏ, lens 35mm",
    "duration": 5,
    "size": "1280x720"
  }'
\`\`\`

## Poll job

\`\`\`bash
curl https://quangthuong.ai/api/v1/videos/{job_id} \\
  -H "Authorization: Bearer sk-bee-..."
\`\`\`

Khi \`status: "succeeded"\` sẽ có \`url\` để download mp4.

## Khuyến nghị

- **sora-2 / sora-2-pro** cho chất lượng cinematic cao nhất
- **veo-3.1-fast-generate-preview** rẻ và nhanh hơn — hợp prototype
- **kling-3.0-std** rẻ nhất, phù hợp social content ngắn
- **seedance-2-pro** mạnh ở chuyển động phức tạp, dance/sports

Tính giá theo **₫ / 1 giây video** — render càng dài càng tốn.`,
  },
  {
    slug: "text-to-speech",
    title: "Text to Speech (TTS)",
    emoji: "🔊",
    summary: "Chuyển văn bản thành giọng nói tự nhiên qua OpenAI TTS và Google.",
    content: `## Endpoint

\`\`\`
POST https://quangthuong.ai/api/v1/audio/speech
\`\`\`

## Python

\`\`\`python
from openai import OpenAI
client = OpenAI(base_url="https://quangthuong.ai/api/v1", api_key="sk-bee-...")

resp = client.audio.speech.create(
    model="openai/tts-1-hd",
    voice="nova",
    input="Xin chào, đây là demo TTS của QUANGTHUONG AI."
)
resp.stream_to_file("hello.mp3")
\`\`\`

## Các giọng

OpenAI TTS có 6 giọng: \`alloy\`, \`echo\`, \`fable\`, \`onyx\`, \`nova\`, \`shimmer\`.

Google Cloud TTS hỗ trợ giọng tiếng Việt: \`vi-VN-Wavenet-A\`, \`vi-VN-Neural2-A\`, ...

## Tính giá

TTS tính theo **₫ / 1M ký tự** — text càng dài càng tốn. Một bài blog 1000 từ ~ 5000 ký tự = giá rất rẻ.`,
  },
  {
    slug: "billing",
    title: "Tính tiền, balance & 402 Payment Required",
    emoji: "💰",
    summary: "Cách hệ thống đếm token, trừ tiền và xử lý khi hết số dư.",
    content: `## Quy tắc tính tiền

Sau mỗi request thành công, hệ thống:

1. Lấy \`usage.prompt_tokens\` và \`usage.completion_tokens\` từ response upstream.
2. Tính: \`cost = (input_tokens × inputPrice + output_tokens × outputPrice) / 1_000_000\`
3. Trừ thẳng vào \`balance\` của user và ghi \`UsageLog\` + \`Transaction\`.

> Stream cũng được tính chính xác: hệ thống parse song song event \`usage\` cuối SSE.

## Khi hết tiền

Nếu \`balance < cost ước tính tối thiểu\`, server trả về:

\`\`\`json
{ "error": { "message": "Insufficient balance", "type": "payment_required" } }
\`\`\`

với HTTP status **402**. Bạn cần nạp thêm trước khi tiếp tục.

## Giảm giá theo tier

Tài khoản tier **Free / Basic / Adv+** có % giảm khác nhau (cấu hình trên từng model). Tier hiện tại của bạn áp dụng tự động — không cần code thêm.

## Theo dõi chi phí

- **Dashboard** → biểu đồ 7 ngày + 10 request gần nhất
- **Sử dụng** → filter theo ngày / model, xuất CSV
- **Transactions** → sổ cái mọi biến động balance`,
  },
  {
    slug: "best-practices",
    title: "Best Practices — tối ưu chi phí & độ tin cậy",
    emoji: "💡",
    summary: "Mẹo chọn model, cache prompt, retry và fallback thông minh.",
    content: `## Chọn model hợp lý

- **Tác vụ đơn giản** (extract JSON, classify, rewrite ngắn): dùng \`claude-haiku-4-5-20251001\`, \`gemini-2.5-flash-lite\`, \`gpt-4o-mini\` — rẻ hơn 10-30 lần so với flagship.
- **Code agent / lập luận sâu**: \`claude-opus-4-6-thinking\` hoặc \`gpt-5-pro\`.
- **Multimodal / chat dài**: \`gemini-2.5-pro\` (context 2M token).

## Cache system prompt

OpenAI và Anthropic đều hỗ trợ cache prompt — chi phí input có thể giảm 90% với prompt cố định lặp lại. Tham khảo doc của provider để bật.

## Retry với fallback

Nếu một provider down, fail over sang model khác cùng tier:

\`\`\`ts
const candidates = ["claude-sonnet-4-6", "gpt-5-pro", "gemini-2.5-pro"];
for (const model of candidates) {
  try {
    return await client.chat.completions.create({ model, messages });
  } catch (e: any) {
    if (e.status >= 500) continue;
    throw e;
  }
}
\`\`\`

## Streaming là free

Tốc độ cảm nhận tăng đáng kể mà không tốn thêm tiền. Bật \`stream: true\` mặc định cho UX chat.

## Tránh lãng phí token

- Cắt history hội thoại — không gửi lại 50 turn cũ mỗi lần.
- Set \`max_tokens\` hợp lý để tránh model "lảm nhảm".
- Dùng \`response_format: { type: "json_object" }\` khi cần JSON — giảm token format thừa.`,
  },
];

export function getDocSection(slug: string) {
  return DOCS_SECTIONS.find((s) => s.slug === slug);
}
