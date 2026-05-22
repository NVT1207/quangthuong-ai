// Anthropic Messages API — chuẩn /v1/messages cho Claude Code CLI.
// Pass-through tới upstream Quang Thưởng AI (gateway gốc hỗ trợ Anthropic format),
// auth bằng sk-bee-... của user và charge theo token usage trong response.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyKey } from "@/lib/api-key";
import { countTokens, computeCost } from "@/lib/pricing";
import { checkApiKeyRateLimit, RATE_LIMIT_PER_MIN } from "@/lib/rate-limit";
import { tierDiscountField, type Tier } from "@/lib/tier";
import {
  callWithFailover,
  buildEndpointUrl,
  authHeaders,
  isUpstreamConfigured,
  UpstreamError,
  describeAdminKeyError,
  type ResolvedUpstream,
} from "@/lib/provider-routing";
import {
  anthropicToOpenAIRequest,
  openaiToAnthropicResponse,
  createAnthropicStreamTranslator,
} from "@/lib/anthropic-bridge";
import { INSUFFICIENT_BALANCE_MESSAGE } from "@/lib/modality-route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SAFE_UPSTREAM_ERROR = "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.";
const SAFE_UPSTREAM_STATUS = 503;
const SENSITIVE_UPSTREAM_PATTERNS = [
  "Số dư tài khoản API không đủ",
  "Chi phí ước tính",
  "Số dư hiện tại",
  "platform.beeknoee.com/billing",
];

function containsSensitiveUpstreamError(text: string) {
  return SENSITIVE_UPSTREAM_PATTERNS.some((p) => text.includes(p));
}

function safeAnthropicMessage(model: string, inputTokens = 0) {
  return {
    id: `msg_safe_${Date.now()}`,
    type: "message",
    role: "assistant",
    model,
    content: [{ type: "text", text: SAFE_UPSTREAM_ERROR }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: inputTokens, output_tokens: countTokens(SAFE_UPSTREAM_ERROR) },
  };
}

function safeAnthropicStream(model: string, inputTokens = 0) {
  const outputTokens = countTokens(SAFE_UPSTREAM_ERROR);
  const events = [
    ["message_start", safeAnthropicMessage(model, inputTokens)],
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: SAFE_UPSTREAM_ERROR } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: outputTokens } }],
    ["message_stop", { type: "message_stop" }],
  ];
  return events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n`).join("\n") + "\n";
}

function safeAnthropicResponse(model: string, inputTokens = 0, stream = false) {
  if (stream) {
    return new Response(safeAnthropicStream(model, inputTokens), {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }
  return NextResponse.json(safeAnthropicMessage(model, inputTokens), { status: 200 });
}

function err(status: number, message: string, type = "invalid_request_error") {
  return NextResponse.json({ type: "error", error: { type, message } }, { status });
}

async function authenticate(req: Request) {
  let token = "";
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) token = auth.slice(7);
  else token = req.headers.get("x-api-key") || "";
  if (!token.startsWith("sk-bee-")) return null;
  const prefix = token.slice(0, 11);
  const candidates = await prisma.apiKey.findMany({
    where: { prefix, revokedAt: null, enabled: true },
    include: { user: true },
  });
  for (const k of candidates) {
    if (await verifyKey(token, k.keyHash)) return k;
  }
  return null;
}

export async function POST(req: Request) {
  if (!(await isUpstreamConfigured())) {
    return err(503, "Upstream chưa cấu hình.", "service_unavailable");
  }

  let body: any;
  try { body = await req.json(); } catch { return err(400, "Invalid JSON"); }
  const modelSlug: string = body?.model;
  const stream = body?.stream === true;
  if (!modelSlug || !Array.isArray(body?.messages)) {
    return err(400, "Missing 'model' or 'messages'");
  }

  const [key, model] = await Promise.all([
    authenticate(req),
    // findFirst vì slug không còn unique — pick 1 row đại diện cho pricing/modality.
    prisma.model.findFirst({ where: { slug: modelSlug, active: true }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!key) return err(401, "Invalid API key", "authentication_error");
  if (key.user.status === "BANNED") return err(403, "Account banned", "permission_error");
  if (!model || !model.active) return err(404, `Model '${modelSlug}' not found`, "not_found_error");

  // Chỉ cho phép TEXT / EMBEDDING gọi /messages
  if (model.modality && model.modality !== "TEXT" && model.modality !== "EMBEDDING") {
    const endpointHint = ({
      IMAGE: "/v1/images/generations",
      VIDEO: "/v1/videos/generations",
      AUDIO_TTS: "/v1/audio/speech",
      AUDIO_STT: "/v1/audio/transcriptions",
    } as Record<string, string>)[model.modality];
    return err(
      400,
      `Model '${modelSlug}' là ${model.modality} — dùng endpoint ${endpointHint ?? "đúng modality"} thay vì /v1/messages.`,
      "invalid_request_error"
    );
  }

  // Key phải subscribe model này — match theo slug (qua join) để gom tất cả row trùng slug.
  const sub = await prisma.apiKeyModel.findFirst({
    where: { apiKeyId: key.id, enabled: true, model: { slug: modelSlug } },
    select: { enabled: true },
  });
  if (!sub || !sub.enabled) {
    return err(403, `API key chưa được kích hoạt cho model '${modelSlug}'. Vào /api-keys → Xem chi tiết → tab Models để thêm/bật model.`, "permission_error");
  }

  const rl = await checkApiKeyRateLimit(key.id);
  if (!rl.ok) return err(429, `Rate limit: tối đa ${RATE_LIMIT_PER_MIN} requests/phút/key. Đã dùng ${rl.count}. Đợi 60s rồi thử lại.`, "rate_limit_error");

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;

  // Pre-check balance with rough input estimate
  const sysText = typeof body.system === "string"
    ? body.system
    : Array.isArray(body.system)
      ? body.system.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n")
      : "";
  const msgText = body.messages.map((m: any) => {
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) {
      return m.content
        .filter((b: any) => b?.type === "text" || b?.type === "tool_use" || b?.type === "tool_result")
        .map((b: any) => b.text || (b.input ? JSON.stringify(b.input) : "") || (typeof b.content === "string" ? b.content : ""))
        .join("\n");
    }
    return "";
  }).join("\n");
  const estInputTokens = countTokens(sysText + "\n" + msgText);
  const discountField = tierDiscountField((key.user.tier as Tier) ?? "FREE");
  const discount = discountField ? ((model as any)[discountField] as number | undefined) ?? 0 : 0;

  // Chặn cứng nếu balance <= 0 (chưa nạp / hết tiền)
  if (key.user.balance <= 0) {
    await prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: 402, ip },
    });
    return err(
      402,
      INSUFFICIENT_BALANCE_MESSAGE,
      "insufficient_balance",
    );
  }

  const minCost = computeCost(estInputTokens, 0, model.inputPrice, model.outputPrice, discount);
  if (key.user.balance < minCost) {
    await prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: 402, ip },
    });
    return err(
      402,
      INSUFFICIENT_BALANCE_MESSAGE,
      "insufficient_balance",
    );
  }

  // Forward to upstream /messages via multi-provider routing + auto failover.
  // Quan trọng: nếu upstream KHÔNG phải Anthropic native (vd ChiaSeGPU, OpenRouter, gateway OpenAI-compat)
  // thì phải dịch request Anthropic → OpenAI shape và dịch response ngược lại — không thì
  // client (Cline / Claude SDK) sẽ nhận response shape sai và báo "empty/malformed (HTTP 200)".
  let upstream: Response;
  let used: ResolvedUpstream | null = null;
  try {
    const result = await callWithFailover(modelSlug, "messages", async (u) => {
      const isAnthropicNative = u.providerType === "ANTHROPIC";
      const url = buildEndpointUrl(u.providerType, u.baseUrl, "messages");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...authHeaders(u.providerType, u.apiKey),
      };
      let payload: any;
      if (isAnthropicNative) {
        headers["anthropic-version"] = req.headers.get("anthropic-version") || "2023-06-01";
        const beta = req.headers.get("anthropic-beta");
        if (beta) headers["anthropic-beta"] = beta;
        payload = { ...body, model: u.upstreamModelSlug };
      } else {
        // Translate Anthropic → OpenAI cho upstream OpenAI-compat
        payload = anthropicToOpenAIRequest(body, u.upstreamModelSlug);
      }
      return fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    });
    upstream = result.res;
    used = result.used;
  } catch (e: any) {
    const status = e instanceof UpstreamError ? e.status : 502;
    const msg = e instanceof UpstreamError && e.adminSide
      ? e.message
      : `API key của admin gặp sự cố — ${describeAdminKeyError(status)}. Vui lòng thử lại sau hoặc báo admin.`;
    await prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status, ip },
    });
    return err(502, msg, "upstream_key_error");
  }

  if (!upstream.ok) {
    await upstream.text().catch(() => "");
    await prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: upstream.status, ip },
    });
    return err(
      502,
      `API key của admin đang lỗi — ${describeAdminKeyError(upstream.status)}. Vui lòng thử lại sau hoặc báo admin kiểm tra Provider.`,
      "upstream_key_error",
    );
  }

  const isAnthropicNative = used?.providerType === "ANTHROPIC";

  if (stream && upstream.body) {
    const decoder = new TextDecoder();
    let inputTokens = estInputTokens;
    let outputTokens = 0;
    let collectedText = "";
    let buffer = "";

    // Translator chỉ tạo khi upstream không phải Anthropic native — dùng để dịch
    // OpenAI SSE chunks → Anthropic SSE events.
    const translator = isAnthropicNative ? null : createAnthropicStreamTranslator(modelSlug, estInputTokens);

    const encoder = new TextEncoder();
    const out = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();

        const forwardLineAnthropic = async (line: string) => {
          if (containsSensitiveUpstreamError(line)) {
            controller.enqueue(encoder.encode(safeAnthropicStream(modelSlug, inputTokens)));
            controller.close();
            await reader.cancel().catch(() => undefined);
            await prisma.usageLog.create({ data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens, outputTokens: 0, cost: 0, status: SAFE_UPSTREAM_STATUS, ip } });
            return false;
          }
          controller.enqueue(encoder.encode(line + "\n"));
          const l = line.trim();
          if (!l.startsWith("data:")) return true;
          const payload = l.slice(5).trim();
          if (!payload || payload === "[DONE]") return true;
          try {
            const j = JSON.parse(payload);
            if (j?.type === "content_block_delta") {
              const deltaText = j?.delta?.text;
              if (typeof deltaText === "string") collectedText += deltaText;
            }
            if (j?.type === "message_start" && j?.message?.usage?.input_tokens != null) {
              inputTokens = j.message.usage.input_tokens;
            }
            if (j?.type === "message_delta") {
              const usageOutput = j?.usage?.output_tokens;
              if (usageOutput != null) outputTokens = usageOutput;
            }
          } catch { /* ignore */ }
          return true;
        };

        const forwardLineOpenAI = async (line: string) => {
          if (containsSensitiveUpstreamError(line)) {
            controller.enqueue(encoder.encode(safeAnthropicStream(modelSlug, inputTokens)));
            controller.close();
            await reader.cancel().catch(() => undefined);
            await prisma.usageLog.create({ data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens, outputTokens: 0, cost: 0, status: SAFE_UPSTREAM_STATUS, ip } });
            return false;
          }
          // Dịch line OpenAI → events Anthropic và forward
          const translated = translator!.feedLine(line);
          if (translated) controller.enqueue(encoder.encode(translated));
          // Cộng dồn text từ delta để fallback tính token nếu upstream không gửi usage
          const l = line.trim();
          if (l.startsWith("data:")) {
            const payload = l.slice(5).trim();
            if (payload && payload !== "[DONE]") {
              try {
                const j = JSON.parse(payload);
                const txt = j?.choices?.[0]?.delta?.content;
                if (typeof txt === "string") collectedText += txt;
              } catch { /* ignore */ }
            }
          }
          return true;
        };

        const forwardLine = isAnthropicNative ? forwardLineAnthropic : forwardLineOpenAI;

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunkText = decoder.decode(value, { stream: true });
            buffer += chunkText;
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!(await forwardLine(line))) return;
            }
          }
          const tail = buffer + decoder.decode();
          if (tail && !(await forwardLine(tail))) return;
        } catch (e: any) {
          controller.error(e);
          return;
        }

        // Flush final translation events (message_delta + message_stop) nếu là OpenAI mode
        if (translator) {
          const finalEvents = translator.finish();
          if (finalEvents) controller.enqueue(encoder.encode(finalEvents));
          inputTokens = translator.getInputTokens() || inputTokens;
          outputTokens = translator.getOutputTokens() || outputTokens;
        }
        controller.close();

        if (outputTokens === 0) outputTokens = countTokens(collectedText);
        const cost = computeCost(inputTokens, outputTokens, model.inputPrice, model.outputPrice, discount);
        const fresh = await prisma.user.findUnique({ where: { id: key.userId } });
        const balance = fresh?.balance ?? key.user.balance;
        const actualCost = Math.min(cost, balance);
        const newBalance = balance - actualCost;
        try {
          await prisma.$transaction([
            prisma.user.update({ where: { id: key.userId }, data: { balance: newBalance } }),
            prisma.usageLog.create({ data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens, outputTokens, cost: actualCost, status: 200, ip } }),
            prisma.transaction.create({ data: { userId: key.userId, type: "USAGE", amount: -actualCost, balanceAfter: newBalance, description: `${model.displayName} — ${inputTokens + outputTokens} tokens (Claude Code)` } }),
            prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }),
          ]);
        } catch {
          await prisma.usageLog.create({ data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens, outputTokens, cost: actualCost, status: 200, ip } });
        }
      },
    });

    return new Response(out, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  // Non-stream
  const json = await upstream.json().catch(() => null);
  if (json?.error && containsSensitiveUpstreamError(JSON.stringify(json))) {
    await prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: 502, ip },
    });
    return safeAnthropicResponse(modelSlug || "claude", estInputTokens, stream);
  }
  if (!json) {
    await prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: 502, ip },
    });
    return err(502, "Upstream trả về không hợp lệ", "api_error");
  }

  // Nếu upstream là OpenAI-compat → response shape là {choices,...} → cần dịch sang Anthropic.
  // Nếu là Anthropic native → response đã có shape {content:[...]} → pass-through.
  const responseJson = isAnthropicNative ? json : openaiToAnthropicResponse(json, modelSlug);

  const inputTokens = isAnthropicNative
    ? (json?.usage?.input_tokens ?? estInputTokens)
    : (json?.usage?.prompt_tokens ?? estInputTokens);
  const outputTokens = isAnthropicNative
    ? (json?.usage?.output_tokens ?? 0)
    : (json?.usage?.completion_tokens ?? 0);
  const cost = computeCost(inputTokens, outputTokens, model.inputPrice, model.outputPrice, discount);

  const fresh = await prisma.user.findUnique({ where: { id: key.userId } });
  const balance = fresh?.balance ?? key.user.balance;
  if (balance < cost) {
    await prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens, outputTokens: 0, cost: 0, status: 402, ip },
    });
    return err(
      402,
      INSUFFICIENT_BALANCE_MESSAGE,
      "insufficient_balance",
    );
  }
  const newBalance = balance - cost;
  await prisma.$transaction([
    prisma.user.update({ where: { id: key.userId }, data: { balance: newBalance } }),
    prisma.usageLog.create({ data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens, outputTokens, cost, status: 200, ip } }),
    prisma.transaction.create({ data: { userId: key.userId, type: "USAGE", amount: -cost, balanceAfter: newBalance, description: `${model.displayName} — ${inputTokens + outputTokens} tokens (Claude Code)` } }),
    prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }),
  ]);

  return NextResponse.json(responseJson);
}


