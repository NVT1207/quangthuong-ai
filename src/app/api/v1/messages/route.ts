// Anthropic Messages API — chuẩn /v1/messages cho Claude Code CLI.
// Pass-through tới upstream Quang Thưởng AI (gateway gốc hỗ trợ Anthropic format),
// auth bằng sk-bee-... của user và charge theo token usage trong response.
//
// Combo định tuyến: nếu body.model trùng tên 1 KeyCombo của key → thử lần lượt
// các member theo strategy (FAILOVER/ROUND_ROBIN/CHEAPEST), tự fallback sang
// member kế khi member hiện tại lỗi (key admin lỗi / upstream 4xx-5xx).

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
import { resolveCombo, orderMembersByStrategy, advanceComboCursor } from "@/lib/key-combo";

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

// Model row dùng cho pricing/modality — pick 1 đại diện theo slug (slug không còn unique).
type ModelRow = NonNullable<Awaited<ReturnType<typeof prisma.model.findFirst>>>;

// Kiểm tra 1 slug có gọi /messages được không cho key này.
// Trả model row nếu OK, hoặc lý do lỗi (dùng cho single-model để giữ nguyên message cũ).
type SlugCheck =
  | { ok: true; model: ModelRow }
  | { ok: false; status: number; message: string; type: string };

async function checkSlug(apiKeyId: string, slug: string): Promise<SlugCheck> {
  const model = await prisma.model.findFirst({ where: { slug, active: true }, orderBy: { createdAt: "asc" } });
  if (!model || !model.active) {
    return { ok: false, status: 404, message: `Model '${slug}' not found`, type: "not_found_error" };
  }
  if (model.modality && model.modality !== "TEXT" && model.modality !== "EMBEDDING") {
    const endpointHint = ({
      IMAGE: "/v1/images/generations",
      VIDEO: "/v1/videos/generations",
      AUDIO_TTS: "/v1/audio/speech",
      AUDIO_STT: "/v1/audio/transcriptions",
    } as Record<string, string>)[model.modality];
    return {
      ok: false,
      status: 400,
      message: `Model '${slug}' là ${model.modality} — dùng endpoint ${endpointHint ?? "đúng modality"} thay vì /v1/messages.`,
      type: "invalid_request_error",
    };
  }
  const sub = await prisma.apiKeyModel.findFirst({
    where: { apiKeyId, enabled: true, model: { slug } },
    select: { enabled: true },
  });
  if (!sub || !sub.enabled) {
    return {
      ok: false,
      status: 403,
      message: `API key chưa được kích hoạt cho model '${slug}'. Vào /api-keys → Xem chi tiết → tab Models để thêm/bật model.`,
      type: "permission_error",
    };
  }
  return { ok: true, model };
}

export async function POST(req: Request) {
  if (!(await isUpstreamConfigured())) {
    return err(503, "Upstream chưa cấu hình.", "service_unavailable");
  }

  let body: any;
  try { body = await req.json(); } catch { return err(400, "Invalid JSON"); }
  const requestedModel: string = body?.model;
  const stream = body?.stream === true;
  if (!requestedModel || !Array.isArray(body?.messages)) {
    return err(400, "Missing 'model' or 'messages'");
  }

  const authed = await authenticate(req);
  if (!authed) return err(401, "Invalid API key", "authentication_error");
  const key = authed; // non-null, giữ narrowing trong các closure (deliver/stream)
  if (key.user.status === "BANNED") return err(403, "Account banned", "permission_error");

  // ── Resolve combo: tên combo ưu tiên hơn model slug khi trùng tên ──
  const combo = await resolveCombo(key.id, requestedModel);

  // Danh sách member khả dụng theo thứ tự thử [{ slug, model }]
  const members: { slug: string; model: ModelRow }[] = [];
  if (combo) {
    // Load model cho từng member để (a) lọc TEXT/subscribe (b) sort CHEAPEST theo giá
    const checks = await Promise.all(combo.memberSlugs.map((s) => checkSlug(key.id, s)));
    const usable = combo.memberSlugs
      .map((slug, i) => ({ slug, c: checks[i] }))
      .filter((x) => x.c.ok) as { slug: string; c: { ok: true; model: ModelRow } }[];
    if (usable.length === 0) {
      return err(404, `Combo '${requestedModel}' không có model khả dụng. Kiểm tra lại các model thành viên (đã thêm vào key + đang bật + là model text).`, "not_found_error");
    }
    const priceBySlug = new Map(usable.map((u) => [u.slug, u.c.model.inputPrice]));
    const ordered = orderMembersByStrategy(usable.map((u) => u.slug), combo.strategy, combo.rrCursor, priceBySlug);
    if (combo.strategy === "ROUND_ROBIN") advanceComboCursor(combo.id).catch(() => undefined);
    const bySlug = new Map(usable.map((u) => [u.slug, u.c.model]));
    for (const slug of ordered) {
      const m = bySlug.get(slug);
      if (m) members.push({ slug, model: m });
    }
  } else {
    const c = await checkSlug(key.id, requestedModel);
    if (!c.ok) return err(c.status, c.message, c.type);
    members.push({ slug: requestedModel, model: c.model });
  }

  const rl = await checkApiKeyRateLimit(key.id);
  if (!rl.ok) return err(429, `Rate limit: tối đa ${RATE_LIMIT_PER_MIN} requests/phút/key. Đã dùng ${rl.count}. Đợi 60s rồi thử lại.`, "rate_limit_error");

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;

  // Pre-check balance with rough input estimate (dùng member đầu tiên làm đại diện giá)
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
  const discountOf = (m: ModelRow) => (discountField ? ((m as any)[discountField] as number | undefined) ?? 0 : 0);

  // Chặn cứng nếu balance <= 0 (chưa nạp / hết tiền)
  if (key.user.balance <= 0) {
    await prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug: members[0].slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: 402, ip },
    });
    return err(402, INSUFFICIENT_BALANCE_MESSAGE, "insufficient_balance");
  }
  const minCost = computeCost(estInputTokens, 0, members[0].model.inputPrice, members[0].model.outputPrice, discountOf(members[0].model));
  if (key.user.balance < minCost) {
    await prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug: members[0].slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: 402, ip },
    });
    return err(402, INSUFFICIENT_BALANCE_MESSAGE, "insufficient_balance");
  }

  const logFail = (slug: string, status: number) =>
    prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug: slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status, ip },
    }).catch(() => undefined);

  // ── deliver: xử lý 1 response upstream OK (stream + non-stream + charge) ──
  // Tách ra để loop combo có thể gọi với member khác nhau. model/modelSlug/discount theo member.
  async function deliver(upstream: Response, used: ResolvedUpstream | null, model: ModelRow, modelSlug: string, discount: number): Promise<Response> {
    const isAnthropicNative = used?.providerType === "ANTHROPIC";

    if (stream && upstream.body) {
      const decoder = new TextDecoder();
      let inputTokens = estInputTokens;
      let outputTokens = 0;
      let collectedText = "";
      let buffer = "";

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
            const translated = translator!.feedLine(line);
            if (translated) controller.enqueue(encoder.encode(translated));
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
      return err(402, INSUFFICIENT_BALANCE_MESSAGE, "insufficient_balance");
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

  // ── Loop qua từng member: thử upstream, fallback sang member kế khi lỗi ──
  // Quan trọng: nếu upstream KHÔNG phải Anthropic native thì dịch Anthropic↔OpenAI shape.
  let lastErrResponse: Response | null = null;
  for (let i = 0; i < members.length; i++) {
    const { slug: attemptSlug, model: attemptModel } = members[i];
    const isLast = i === members.length - 1;
    const discount = discountOf(attemptModel);

    let upstream: Response;
    let used: ResolvedUpstream | null = null;
    try {
      const result = await callWithFailover(attemptSlug, "messages", async (u) => {
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
          payload = anthropicToOpenAIRequest(body, u.upstreamModelSlug);
        }
        return fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
      });
      upstream = result.res;
      used = result.used;
    } catch (e: any) {
      const status = e instanceof UpstreamError ? e.status : 502;
      const msg = e instanceof UpstreamError && e.adminSide
        ? e.message
        : `API key của admin gặp sự cố — ${describeAdminKeyError(status)}. Vui lòng thử lại sau hoặc báo admin.`;
      await logFail(attemptSlug, status);
      if (!isLast) continue; // combo → thử member kế
      return err(502, msg, "upstream_key_error");
    }

    if (!upstream.ok) {
      await upstream.text().catch(() => "");
      await logFail(attemptSlug, upstream.status);
      if (!isLast) continue; // combo → thử member kế
      return err(
        502,
        `API key của admin đang lỗi — ${describeAdminKeyError(upstream.status)}. Vui lòng thử lại sau hoặc báo admin kiểm tra Provider.`,
        "upstream_key_error",
      );
    }

    // Upstream OK → giao kết quả (charge theo model của member này)
    return deliver(upstream, used, attemptModel, attemptSlug, discount);
  }

  // Không bao giờ tới đây (loop luôn return ở member cuối), nhưng để TS yên tâm:
  return lastErrResponse ?? err(502, "Không có member khả dụng cho combo.", "api_error");
}
