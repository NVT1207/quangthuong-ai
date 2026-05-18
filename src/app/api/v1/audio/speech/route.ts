// TTS endpoint — OpenAI-compatible shape.
// Body: { model, input, voice, response_format? }
// Charge per character.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTtsCost, type TtsPricing } from "@/lib/pricing";
import { formatVND } from "@/lib/format";
import { authHeaders, buildEndpointUrl, callWithFailover, UpstreamError } from "@/lib/provider-routing";
import { loadCallContext, chargeModality, logModalityError, err } from "@/lib/modality-route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return err(400, "Invalid JSON"); }

  const modelSlug = body?.model;
  const input = typeof body?.input === "string" ? body.input : "";
  const voice = typeof body?.voice === "string" ? body.voice : "";
  const responseFormat = typeof body?.response_format === "string" ? body.response_format : "mp3";
  const speed = Number.isFinite(Number(body?.speed)) ? Number(body.speed) : undefined;

  if (!input.trim()) return err(400, "Missing 'input'");
  if (!voice.trim()) return err(400, "Missing 'voice'");

  const ctx = await loadCallContext(req, modelSlug, "AUDIO_TTS");
  if ("error" in ctx && ctx.error) return ctx.error;
  const { key, model, discount, ip } = ctx as Exclude<typeof ctx, { error: NextResponse }>;

  const pricing = (model.pricingData as unknown) as TtsPricing | null;
  if (!pricing || !Number.isFinite(pricing.charRate)) {
    return err(400, `Model '${modelSlug}' chưa cấu hình giá. Báo admin set pricingData.charRate.`);
  }
  if (pricing.voices?.length && !pricing.voices.some((v) => v.id === voice)) {
    return err(400, `Voice '${voice}' không hỗ trợ. Voices: ${pricing.voices.map(v => v.id).join(", ")}.`);
  }

  const chars = input.length;
  const cost = computeTtsCost(pricing, { chars }, discount);
  const unitsMeta = { chars, voice };

  if (key.user.balance <= 0) {
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "AUDIO_TTS", unitsMeta, status: 402, ip });
    return err(402, `Số dư bằng 0. Nạp tại https://quangthuong-ai.vercel.app/topup.`, "insufficient_balance");
  }
  if (key.user.balance < cost) {
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "AUDIO_TTS", unitsMeta, status: 402, ip });
    return err(
      402,
      `Số dư không đủ (cần ${formatVND(cost)} cho ${chars} chars, có ${formatVND(key.user.balance)}). Nạp tại https://quangthuong-ai.vercel.app/topup.`,
      "insufficient_balance",
    );
  }

  let upstreamRes: Response;
  try {
    const { res } = await callWithFailover(model.slug, "audio_speech", async (u) => {
      const url = buildEndpointUrl(u.providerType, u.baseUrl, "audio_speech");
      const payload: any = {
        model: u.upstreamModelSlug,
        input,
        voice,
        response_format: responseFormat,
      };
      if (speed !== undefined) payload.speed = speed;
      return fetch(url, {
        method: "POST",
        headers: { ...authHeaders(u.providerType, u.apiKey), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    });
    upstreamRes = res;
  } catch (e: any) {
    const status = e instanceof UpstreamError ? e.status : 502;
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "AUDIO_TTS", unitsMeta, status, ip });
    return err(status, e?.message || "Upstream TTS failed", "upstream_error");
  }

  if (!upstreamRes.ok) {
    const status = upstreamRes.status;
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "AUDIO_TTS", unitsMeta, status, ip });
    const body = await upstreamRes.text().catch(() => "");
    return err(status, `Upstream TTS lỗi ${status}. ${body.slice(0, 200)}`, "upstream_error");
  }

  // Charge + log
  const fresh = await prisma.user.findUnique({ where: { id: key.userId } });
  const balance = fresh?.balance ?? key.user.balance;
  const actualCost = Math.min(cost, balance);
  try {
    await chargeModality({
      userId: key.userId,
      apiKeyId: key.id,
      balance,
      cost: actualCost,
      modelSlug: model.slug,
      modelName: model.displayName,
      modality: "AUDIO_TTS",
      unitsMeta,
      description: `${model.displayName} — TTS ${chars} chars / voice=${voice} (API)`,
      ip,
    });
  } catch {
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "AUDIO_TTS", unitsMeta, status: 200, ip });
  }

  // Stream audio bytes về client
  const contentType = upstreamRes.headers.get("content-type") || `audio/${responseFormat}`;
  return new Response(upstreamRes.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
