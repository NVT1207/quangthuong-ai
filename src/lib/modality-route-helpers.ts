// Helpers chia sẻ cho 4 modality routes (images/videos/audio_speech/audio_transcriptions).
// Auth bằng API key Bearer (sk-bee-…), check subscription, rate-limit, log usage.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyKey } from "@/lib/api-key";
import { checkApiKeyRateLimit, RATE_LIMIT_PER_MIN } from "@/lib/rate-limit";
import { tierDiscountField, type Tier } from "@/lib/tier";

export function err(status: number, message: string, type = "invalid_request_error") {
  return NextResponse.json({ error: { message, type, code: status } }, { status });
}

export async function authenticate(req: Request) {
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

export function getIp(req: Request): string | null {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
}

export function getDiscount(tier: string | undefined, model: any): number {
  const field = tierDiscountField((tier as Tier) ?? "FREE");
  if (!field) return 0;
  return (model[field] as number | undefined) ?? 0;
}

// Load + verify đầy đủ: API key valid, user not banned, model active, modality khớp, subscription enabled, rate-limit OK.
// Trả NextResponse (early-return error) hoặc { key, model, discount, ip }.
export async function loadCallContext(
  req: Request,
  modelSlug: string,
  expectedModality: "IMAGE" | "VIDEO" | "AUDIO_TTS" | "AUDIO_STT",
) {
  if (!modelSlug) return { error: err(400, "Missing 'model'") };
  const [key, model] = await Promise.all([
    authenticate(req),
    prisma.model.findUnique({ where: { slug: modelSlug } }),
  ]);
  if (!key) return { error: err(401, "Invalid API key", "authentication_error") };
  if (key.user.status === "BANNED") return { error: err(403, "Account banned", "permission_error") };
  if (!model || !model.active) return { error: err(404, `Model '${modelSlug}' not found`, "not_found_error") };
  if (model.modality !== expectedModality) {
    return {
      error: err(
        400,
        `Model '${modelSlug}' là ${model.modality} — không hỗ trợ endpoint này (cần ${expectedModality}).`,
      ),
    };
  }
  const sub = await prisma.apiKeyModel.findUnique({
    where: { apiKeyId_modelId: { apiKeyId: key.id, modelId: model.id } },
    select: { enabled: true },
  });
  if (!sub || !sub.enabled) {
    return {
      error: err(
        403,
        `API key chưa kích hoạt cho model '${modelSlug}'. Vào /api-keys → Xem chi tiết → tab Models.`,
        "permission_error",
      ),
    };
  }
  const rl = await checkApiKeyRateLimit(key.id);
  if (!rl.ok) {
    return {
      error: err(
        429,
        `Rate limit: tối đa ${RATE_LIMIT_PER_MIN} requests/phút/key. Đã dùng ${rl.count}. Đợi 60s.`,
        "rate_limit_error",
      ),
    };
  }
  return {
    key,
    model,
    discount: getDiscount(key.user.tier, model),
    ip: getIp(req),
  };
}

// Trừ tiền + log usage modality.
export async function chargeModality(opts: {
  userId: string;
  apiKeyId: string;
  balance: number;
  cost: number;
  modelSlug: string;
  modelName: string;
  modality: string;
  unitsMeta: any;
  description: string;
  ip: string | null;
}) {
  const newBalance = opts.balance - opts.cost;
  await prisma.$transaction([
    prisma.user.update({ where: { id: opts.userId }, data: { balance: newBalance } }),
    prisma.usageLog.create({
      data: {
        userId: opts.userId,
        apiKeyId: opts.apiKeyId,
        modelSlug: opts.modelSlug,
        inputTokens: 0,
        outputTokens: 0,
        cost: opts.cost,
        status: 200,
        ip: opts.ip,
        modality: opts.modality,
        unitsMeta: opts.unitsMeta,
      },
    }),
    prisma.transaction.create({
      data: {
        userId: opts.userId,
        type: "USAGE",
        amount: -opts.cost,
        balanceAfter: newBalance,
        description: opts.description,
      },
    }),
    prisma.apiKey.update({ where: { id: opts.apiKeyId }, data: { lastUsedAt: new Date() } }),
  ]);
}

// Log usage cho request fail (không trừ tiền).
export async function logModalityError(opts: {
  userId: string;
  apiKeyId: string;
  modelSlug: string;
  modality: string;
  unitsMeta: any;
  status: number;
  ip: string | null;
}) {
  await prisma.usageLog
    .create({
      data: {
        userId: opts.userId,
        apiKeyId: opts.apiKeyId,
        modelSlug: opts.modelSlug,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        status: opts.status,
        ip: opts.ip,
        modality: opts.modality,
        unitsMeta: opts.unitsMeta,
      },
    })
    .catch(() => undefined);
}
