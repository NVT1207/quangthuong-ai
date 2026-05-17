// Upstream wrapper — refactor để dùng multi-provider routing.
// Vẫn giữ public API `callUpstream` / `readNonStream` / `UpstreamError` / `isUpstreamConfigured`
// để route hiện tại không phải thay đổi.

import {
  authHeaders,
  buildEndpointUrl,
  callWithFailover,
  UpstreamError,
  describeAdminKeyError,
  isUpstreamConfigured as isUpstreamConfiguredCore,
} from "@/lib/provider-routing";

export { UpstreamError, describeAdminKeyError };

export async function isUpstreamConfigured(): Promise<boolean> {
  return isUpstreamConfiguredCore();
}

// Backward-compat sync helper cho callers cũ — chỉ check env.
// Caller mới nên dùng async isUpstreamConfigured() ở trên.
export function upstreamConfigStatus(): { configured: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.BEEKNOEE_BASE_URL) missing.push("BEEKNOEE_BASE_URL");
  if (!process.env.BEEKNOEE_API_KEY) missing.push("BEEKNOEE_API_KEY");
  return { configured: missing.length === 0, missing };
}

type UpstreamRequest = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  extra?: Record<string, any>;
};

// Gọi chat/completions qua failover routing. Trả Response (caller xử stream/non-stream).
export async function callUpstream(req: UpstreamRequest): Promise<Response> {
  const { res } = await callWithFailover(req.model, "chat", async (u) => {
    const url = buildEndpointUrl(u.providerType, u.baseUrl, "chat");
    let payload: any;

    if (u.providerType === "ANTHROPIC") {
      const systemParts: string[] = [];
      const anthropicMessages = req.messages
        .map((m: any) => {
          if (m.role === "system") {
            if (m.content) systemParts.push(String(m.content));
            return null;
          }
          return {
            role: m.role === "assistant" ? "assistant" : "user",
            content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
          };
        })
        .filter(Boolean);

      payload = {
        model: u.upstreamModelSlug,
        messages: anthropicMessages,
        max_tokens: req.extra?.max_tokens ?? 1024,
        stream: req.stream === true,
        ...(systemParts.length ? { system: systemParts.join("\n") } : {}),
        ...(req.extra || {}),
      };
    } else {
      payload = {
        model: u.upstreamModelSlug,
        messages: req.messages,
        stream: req.stream === true,
        ...(req.extra || {}),
      };
    }

    try {
      return await fetch(url, {
        method: "POST",
        headers: {
          ...authHeaders(u.providerType, u.apiKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (e: any) {
      throw new UpstreamError(
        502,
        `Không kết nối được tới upstream: ${e?.message || e}`
      );
    }
  });
  return res;
}

// Đọc response non-stream OpenAI-compat hoặc Anthropic Messages → text + usage.
export async function readNonStream(res: Response): Promise<{
  text: string;
  promptTokens?: number;
  completionTokens?: number;
  raw: any;
}> {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    // Status từ upstream-level → coi như admin-side key error
    const safeMsg = `API key của admin gặp sự cố — ${describeAdminKeyError(res.status)}. Vui lòng thử lại sau hoặc báo admin.`;
    throw new UpstreamError(res.status, safeMsg, json, true);
  }

  const openAiText: string | undefined = json?.choices?.[0]?.message?.content;
  const anthropicText = Array.isArray(json?.content)
    ? json.content
        .filter((b: any) => b?.type === "text" && typeof b?.text === "string")
        .map((b: any) => b.text)
        .join("")
    : undefined;

  const usage = json?.usage || {};
  return {
    text: openAiText ?? anthropicText ?? "",
    promptTokens: usage.prompt_tokens ?? usage.input_tokens,
    completionTokens: usage.completion_tokens ?? usage.output_tokens,
    raw: json,
  };
}
