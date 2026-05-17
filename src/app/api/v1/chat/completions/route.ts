import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyKey } from "@/lib/api-key";
import { countTokens, computeCost } from "@/lib/pricing";
import { callUpstream, readNonStream, UpstreamError, isUpstreamConfigured } from "@/lib/upstream";
import { checkApiKeyRateLimit, RATE_LIMIT_PER_MIN } from "@/lib/rate-limit";
import { tierDiscountField, type Tier } from "@/lib/tier";
import { formatVND } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function err(status: number, message: string, type = "invalid_request_error") {
  return NextResponse.json({ error: { message, type, code: status } }, { status });
}

function upstreamErr(status: number) {
  return err(status, "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.", "upstream_error");
}

async function authenticate(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
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

async function logUsage(opts: {
  userId: string; apiKeyId: string; modelSlug: string;
  inputTokens: number; outputTokens: number; cost: number;
  status: number; ip: string | null;
}) {
  await prisma.usageLog.create({ data: opts });
}

async function chargeUser(opts: {
  userId: string; apiKeyId: string; balance: number; cost: number;
  modelSlug: string; modelName: string; inputTokens: number; outputTokens: number; ip: string | null;
}) {
  const newBalance = opts.balance - opts.cost;
  await prisma.$transaction([
    prisma.user.update({ where: { id: opts.userId }, data: { balance: newBalance } }),
    prisma.usageLog.create({
      data: {
        userId: opts.userId, apiKeyId: opts.apiKeyId, modelSlug: opts.modelSlug,
        inputTokens: opts.inputTokens, outputTokens: opts.outputTokens, cost: opts.cost,
        status: 200, ip: opts.ip,
      },
    }),
    prisma.transaction.create({
      data: {
        userId: opts.userId, type: "USAGE", amount: -opts.cost, balanceAfter: newBalance,
        description: `${opts.modelName} — ${opts.inputTokens + opts.outputTokens} tokens (API)`,
      },
    }),
    prisma.apiKey.update({ where: { id: opts.apiKeyId }, data: { lastUsedAt: new Date() } }),
  ]);
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return err(400, "Invalid JSON"); }
  const modelSlug = body?.model;
  const messages = body?.messages;
  const stream = body?.stream === true;
  if (!modelSlug || !Array.isArray(messages)) return err(400, "Missing 'model' or 'messages'");

  const [key, model] = await Promise.all([
    authenticate(req),
    prisma.model.findUnique({ where: { slug: modelSlug } }),
  ]);
  if (!key) return err(401, "Invalid API key", "authentication_error");
  if (key.user.status === "BANNED") return err(403, "Account banned", "permission_error");
  if (!model || !model.active) return err(404, `Model '${modelSlug}' not found`, "not_found_error");

  // Key phải subscribe model này (mỗi key tự chọn model trong /api-keys → Xem chi tiết → Models)
  const sub = await prisma.apiKeyModel.findUnique({
    where: { apiKeyId_modelId: { apiKeyId: key.id, modelId: model.id } },
    select: { enabled: true },
  });
  if (!sub || !sub.enabled) {
    return err(403, `API key chưa được kích hoạt cho model '${modelSlug}'. Vào /api-keys → Xem chi tiết → tab Models để thêm/bật model.`, "permission_error");
  }

  const rl = await checkApiKeyRateLimit(key.id);
  if (!rl.ok) return err(429, `Rate limit: tối đa ${RATE_LIMIT_PER_MIN} requests/phút/key. Đã dùng ${rl.count}. Đợi 60s rồi thử lại.`, "rate_limit_error");

  if (!(await isUpstreamConfigured())) {
    return err(503, "Upstream chưa cấu hình. Liên hệ admin để tạo Provider hoặc đặt BEEKNOEE_BASE_URL/API_KEY env.", "service_unavailable");
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const inputText = messages.map((x: any) => x.content ?? "").join("\n");
  const estInputTokens = countTokens(inputText);

  const discountField = tierDiscountField((key.user.tier as Tier) ?? "FREE");
  const discount = discountField ? ((model as any)[discountField] as number | undefined) ?? 0 : 0;

  // Pre-check số dư: phải có tiền mới được gọi. Chặn ngay nếu balance <= 0 hoặc không đủ trả input.
  if (key.user.balance <= 0) {
    await logUsage({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: 402, ip });
    return err(402, `Số dư tài khoản bằng 0. Vui lòng nạp tiền tại https://beeknoee.com/topup trước khi sử dụng API.`, "insufficient_balance");
  }
  const minCost = computeCost(estInputTokens, 0, model.inputPrice, model.outputPrice, discount);
  if (key.user.balance < minCost) {
    await logUsage({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: 402, ip });
    return err(402, `Số dư không đủ (hiện có ${formatVND(key.user.balance)}, cần tối thiểu ${formatVND(minCost)} cho prompt này). Nạp thêm tại https://beeknoee.com/topup`, "insufficient_balance");
  }

  // Gom các option pass-through chuẩn OpenAI
  const extra: Record<string, any> = {};
  for (const k of ["temperature", "top_p", "max_tokens", "presence_penalty", "frequency_penalty", "stop", "n", "seed", "response_format", "tools", "tool_choice"]) {
    if (body[k] !== undefined) extra[k] = body[k];
  }

  // === STREAM ===
  if (stream) {
    let upstream: Response;
    try {
      upstream = await callUpstream({ model: model.slug, messages, stream: true, extra });
    } catch (e: any) {
      const status = e instanceof UpstreamError ? e.status : 502;
      await logUsage({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status, ip });
      return upstreamErr(status);
    }
    if (!upstream.ok || !upstream.body) {
      await upstream.text().catch(() => "");
      await logUsage({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: upstream.status, ip });
      if (upstream.status === 402 || upstream.status === 429) {
        return err(upstream.status, "Insufficient balance.", "billing_error");
      }
      if (upstream.status >= 500) {
        return err(502, "Upstream tạm thời không khả dụng. Vui lòng thử lại.", "upstream_error");
      }
      return err(upstream.status, `Yêu cầu bị từ chối (mã ${upstream.status}).`, "upstream_error");
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let collectedText = "";
    let upstreamCompletionTokens: number | undefined;
    let buffer = "";

    const out = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            // Không forward raw ngay: upstream có thể trả lỗi dạng SSE 200 và lộ nội dung billing.
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const l = line.trim();
              if (
                l.includes("Số dư tài khoản API không đủ") ||
                l.includes("Chi phí ước tính") ||
                l.includes("Số dư hiện tại") ||
                l.includes("platform.beeknoee.com/billing")
              ) {
                controller.enqueue(encoder.encode('data: {"error":{"message":"Không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.","type":"upstream_error"}}\n\n'));
                controller.close();
                return;
              }

              // Forward từng dòng đã kiểm tra an toàn cho client.
              controller.enqueue(encoder.encode(line + "\n"));

              // Parse song song để cộng dồn text + bắt usage (nếu upstream gửi)
              if (!l.startsWith("data:")) continue;
              const payload = l.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const j = JSON.parse(payload);
                const delta = j?.choices?.[0]?.delta?.content;
                if (typeof delta === "string") collectedText += delta;
                if (j?.usage?.completion_tokens != null) upstreamCompletionTokens = j.usage.completion_tokens;
              } catch { /* ignore parse */ }
            }
          }
        } catch (e: any) {
          controller.error(e);
          return;
        }
        controller.close();

        // Sau khi stream kết thúc → tính cost + ghi log + trừ tiền
        const outputTokens = upstreamCompletionTokens ?? countTokens(collectedText);
        const cost = computeCost(estInputTokens, outputTokens, model.inputPrice, model.outputPrice, discount);
        // Re-fetch balance để tránh race với request khác
        const fresh = await prisma.user.findUnique({ where: { id: key.userId } });
        const balance = fresh?.balance ?? key.user.balance;
        const actualCost = Math.min(cost, balance);
        try {
          await chargeUser({
            userId: key.userId, apiKeyId: key.id, balance, cost: actualCost,
            modelSlug: model.slug, modelName: model.displayName,
            inputTokens: estInputTokens, outputTokens, ip,
          });
        } catch {
          // Log thường nếu transaction fail
          await logUsage({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, inputTokens: estInputTokens, outputTokens, cost: actualCost, status: 200, ip });
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

  // === NON-STREAM ===
  let upstream: Response;
  try {
    upstream = await callUpstream({ model: model.slug, messages, stream: false, extra });
  } catch (e: any) {
    const status = e instanceof UpstreamError ? e.status : 502;
    await logUsage({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status, ip });
    return upstreamErr(status);
  }

  let parsed;
  try {
    parsed = await readNonStream(upstream);
  } catch (e: any) {
    const status = e instanceof UpstreamError ? e.status : 502;
    await logUsage({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status, ip });
    return upstreamErr(status);
  }

  const inputTokens = parsed.promptTokens ?? estInputTokens;
  const outputTokens = parsed.completionTokens ?? countTokens(parsed.text);
  const cost = computeCost(inputTokens, outputTokens, model.inputPrice, model.outputPrice, discount);

  const fresh = await prisma.user.findUnique({ where: { id: key.userId } });
  const balance = fresh?.balance ?? key.user.balance;
  if (balance < cost) {
    await logUsage({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, inputTokens, outputTokens: 0, cost: 0, status: 402, ip });
    return err(402, `Số dư không đủ sau khi tính phí (cần ${formatVND(cost)}, hiện có ${formatVND(balance)}). Nạp thêm tại https://beeknoee.com/topup`, "insufficient_balance");
  }
  await chargeUser({
    userId: key.userId, apiKeyId: key.id, balance, cost,
    modelSlug: model.slug, modelName: model.displayName,
    inputTokens, outputTokens, ip,
  });

  // Trả nguyên response upstream để client thấy đầy đủ id / system_fingerprint / etc.
  return NextResponse.json(parsed.raw);
}

