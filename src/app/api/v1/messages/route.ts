// Anthropic Messages API — chuẩn /v1/messages cho Claude Code CLI.
// Pass-through tới upstream Beeknoee (gateway gốc hỗ trợ Anthropic format),
// auth bằng sk-bee-... của user và charge theo token usage trong response.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyKey } from "@/lib/api-key";
import { countTokens, computeCost } from "@/lib/pricing";
import { checkApiKeyRateLimit, RATE_LIMIT_PER_MIN } from "@/lib/rate-limit";
import { tierDiscountField, type Tier } from "@/lib/tier";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE_URL = (process.env.BEEKNOEE_BASE_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.BEEKNOEE_API_KEY || "";

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
  if (!BASE_URL || !API_KEY) {
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
    prisma.model.findUnique({ where: { slug: modelSlug } }),
  ]);
  if (!key) return err(401, "Invalid API key", "authentication_error");
  if (key.user.status === "BANNED") return err(403, "Account banned", "permission_error");
  if (!model || !model.active) return err(404, `Model '${modelSlug}' not found`, "not_found_error");

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
  const discount = ((model as any)[discountField] as number | undefined) ?? 0;
  const minCost = computeCost(estInputTokens, 0, model.inputPrice, model.outputPrice, discount);
  if (key.user.balance < minCost) {
    await prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: 402, ip },
    });
    return err(402, "Insufficient balance.", "billing_error");
  }

  // Forward to upstream /messages
  const url = `${BASE_URL}/messages`;
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "x-api-key": API_KEY,
        "anthropic-version": req.headers.get("anthropic-version") || "2023-06-01",
        "anthropic-beta": req.headers.get("anthropic-beta") || "",
      },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    await prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: 502, ip },
    });
    return err(502, `Không kết nối upstream: ${e?.message || e}`, "api_error");
  }

  if (!upstream.ok) {
    await upstream.text().catch(() => "");
    await prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: upstream.status, ip },
    });
    if (upstream.status === 402 || upstream.status === 429) {
      return err(upstream.status, "Insufficient balance.", "billing_error");
    }
    if (upstream.status >= 500) {
      return err(502, "Upstream tạm thời không khả dụng. Vui lòng thử lại.", "api_error");
    }
    return err(upstream.status, `Yêu cầu bị từ chối (mã ${upstream.status}).`, "api_error");
  }

  if (stream && upstream.body) {
    const decoder = new TextDecoder();
    let inputTokens = estInputTokens;
    let outputTokens = 0;
    let buffer = "";

    const out = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            controller.enqueue(value);
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const l = line.trim();
              if (!l.startsWith("data:")) continue;
              const payload = l.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const j = JSON.parse(payload);
                if (j?.type === "message_start" && j?.message?.usage?.input_tokens != null) {
                  inputTokens = j.message.usage.input_tokens;
                }
                if (j?.type === "message_delta" && j?.usage?.output_tokens != null) {
                  outputTokens = j.usage.output_tokens;
                }
              } catch { /* ignore */ }
            }
          }
        } catch (e: any) {
          controller.error(e);
          return;
        }
        controller.close();

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
  if (!json) {
    await prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens: estInputTokens, outputTokens: 0, cost: 0, status: 502, ip },
    });
    return err(502, "Upstream trả về không hợp lệ", "api_error");
  }
  const inputTokens = json?.usage?.input_tokens ?? estInputTokens;
  const outputTokens = json?.usage?.output_tokens ?? 0;
  const cost = computeCost(inputTokens, outputTokens, model.inputPrice, model.outputPrice, discount);

  const fresh = await prisma.user.findUnique({ where: { id: key.userId } });
  const balance = fresh?.balance ?? key.user.balance;
  if (balance < cost) {
    await prisma.usageLog.create({
      data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens, outputTokens: 0, cost: 0, status: 402, ip },
    });
    return err(402, "Insufficient balance.", "billing_error");
  }
  const newBalance = balance - cost;
  await prisma.$transaction([
    prisma.user.update({ where: { id: key.userId }, data: { balance: newBalance } }),
    prisma.usageLog.create({ data: { userId: key.userId, apiKeyId: key.id, modelSlug, inputTokens, outputTokens, cost, status: 200, ip } }),
    prisma.transaction.create({ data: { userId: key.userId, type: "USAGE", amount: -cost, balanceAfter: newBalance, description: `${model.displayName} — ${inputTokens + outputTokens} tokens (Claude Code)` } }),
    prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }),
  ]);

  return NextResponse.json(json);
}
