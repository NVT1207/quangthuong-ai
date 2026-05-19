// Video generation endpoint — OpenAI-compatible shape (sync only phase 1).
// Body: { model, prompt, resolution, duration }
// Charge per-video theo matrix resolution × duration. Async task polling (Sora) out-of-scope.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeVideoCost, type VideoPricing } from "@/lib/pricing";
import { authHeaders, buildEndpointUrl, callWithFailover, UpstreamError } from "@/lib/provider-routing";
import { loadCallContext, chargeModality, logModalityError, err, INSUFFICIENT_BALANCE_MESSAGE } from "@/lib/modality-route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return err(400, "Invalid JSON"); }

  const modelSlug = body?.model;
  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  const resolution = typeof body?.resolution === "string" ? body.resolution : "720p";
  const duration = typeof body?.duration === "string" ? body.duration : "8s";

  if (!prompt.trim()) return err(400, "Missing 'prompt'");

  const ctx = await loadCallContext(req, modelSlug, "VIDEO");
  if ("error" in ctx && ctx.error) return ctx.error;
  const { key, model, discount, ip } = ctx as Exclude<typeof ctx, { error: NextResponse }>;

  const pricing = (model.pricingData as unknown) as VideoPricing | null;
  if (!pricing || !Array.isArray(pricing.matrix) || pricing.matrix.length === 0) {
    return err(400, `Model '${modelSlug}' chưa cấu hình giá. Báo admin set pricingData.`);
  }

  const { cost, matched } = computeVideoCost(pricing, { resolution, duration }, discount);
  if (!matched) {
    return err(
      400,
      `Combo resolution=${resolution} × duration=${duration} không có trong bảng giá. Combo hỗ trợ: ${pricing.matrix.map(r => `${r.resolution}/${r.duration}`).join(", ")}.`,
    );
  }

  const unitsMeta = { resolution, duration };

  if (key.user.balance <= 0) {
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "VIDEO", unitsMeta, status: 402, ip });
    return err(402, INSUFFICIENT_BALANCE_MESSAGE, "insufficient_balance");
  }
  if (key.user.balance < cost) {
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "VIDEO", unitsMeta, status: 402, ip });
    return err(402, INSUFFICIENT_BALANCE_MESSAGE, "insufficient_balance");
  }

  let upstreamRes: Response;
  try {
    const { res } = await callWithFailover(model.slug, "videos", async (u) => {
      const url = buildEndpointUrl(u.providerType, u.baseUrl, "videos");
      return fetch(url, {
        method: "POST",
        headers: { ...authHeaders(u.providerType, u.apiKey), "Content-Type": "application/json" },
        body: JSON.stringify({
          model: u.upstreamModelSlug,
          prompt,
          resolution,
          duration,
        }),
      });
    });
    upstreamRes = res;
  } catch (e: any) {
    const status = e instanceof UpstreamError ? e.status : 502;
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "VIDEO", unitsMeta, status, ip });
    return err(status, e?.message || "Upstream video generation failed", "upstream_error");
  }

  if (!upstreamRes.ok) {
    const status = upstreamRes.status;
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "VIDEO", unitsMeta, status, ip });
    const body = await upstreamRes.text().catch(() => "");
    return err(status, `Upstream video lỗi ${status}. ${body.slice(0, 200)}`, "upstream_error");
  }

  const data = await upstreamRes.json().catch(() => null);

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
      modality: "VIDEO",
      unitsMeta,
      description: `${model.displayName} — video ${resolution}/${duration} (API)`,
      ip,
    });
  } catch {
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "VIDEO", unitsMeta, status: 200, ip });
  }

  return NextResponse.json(data ?? { created: Math.floor(Date.now() / 1000), data: [] });
}
