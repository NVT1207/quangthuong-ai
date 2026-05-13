// Forward chat completion tới upstream gateway (Beeknoee gốc — OpenAI-compatible).
// Trả về { ok, text, outputTokens, raw } khi non-stream, hoặc throw UpstreamError.

const BASE_URL = (process.env.BEEKNOEE_BASE_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.BEEKNOEE_API_KEY || "";

export class UpstreamError extends Error {
  status: number;
  body: any;
  constructor(status: number, message: string, body?: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function isUpstreamConfigured(): boolean {
  return Boolean(BASE_URL && API_KEY);
}

export function upstreamConfigStatus(): { configured: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!BASE_URL) missing.push("BEEKNOEE_BASE_URL");
  if (!API_KEY) missing.push("BEEKNOEE_API_KEY");
  return { configured: missing.length === 0, missing };
}

type UpstreamRequest = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  // pass-through các option khác (temperature, max_tokens...) nếu có
  extra?: Record<string, any>;
};

export async function callUpstream(req: UpstreamRequest): Promise<Response> {
  if (!isUpstreamConfigured()) {
    throw new UpstreamError(503, "Upstream chưa được cấu hình. Đặt BEEKNOEE_BASE_URL và BEEKNOEE_API_KEY trong .env.");
  }
  const url = `${BASE_URL}/chat/completions`;
  const payload: any = {
    model: req.model,
    messages: req.messages,
    stream: req.stream === true,
    ...(req.extra || {}),
  };
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (e: any) {
    throw new UpstreamError(502, `Không kết nối được tới upstream: ${e?.message || e}`);
  }
  return res;
}

// Đọc response non-stream → text + usage.completion_tokens (nếu upstream trả).
export async function readNonStream(res: Response): Promise<{
  text: string;
  promptTokens?: number;
  completionTokens?: number;
  raw: any;
}> {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const safeMsg =
      res.status === 402 || res.status === 429
        ? "Insufficient balance."
        : res.status >= 500
          ? "Upstream tạm thời không khả dụng. Vui lòng thử lại."
          : `Yêu cầu bị từ chối (mã ${res.status}).`;
    throw new UpstreamError(res.status, safeMsg, json);
  }
  const text: string = json?.choices?.[0]?.message?.content ?? "";
  const usage = json?.usage || {};
  return {
    text,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    raw: json,
  };
}
