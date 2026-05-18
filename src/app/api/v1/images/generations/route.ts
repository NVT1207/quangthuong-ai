// Image generation endpoint — OpenAI-compatible shape.
// Body: { model, prompt, size, quality, n }
// Charge per-image theo matrix size × quality.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeImageCost, type ImagePricing } from "@/lib/pricing";
import { formatVND } from "@/lib/format";
import { authHeaders, buildEndpointUrl, callWithFailover, UpstreamError } from "@/lib/provider-routing";
import { loadCallContext, chargeModality, logModalityError, err } from "@/lib/modality-route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return err(400, "Invalid JSON"); }

  const modelSlug = body?.model;
  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  const size = typeof body?.size === "string" ? body.size : "1024x1024";
  const quality = typeof body?.quality === "string" ? body.quality : "auto";
  const n = Math.max(1, Math.min(10, Number(body?.n) || 1));

  if (!prompt.trim()) return err(400, "Missing 'prompt'");

  const ctx = await loadCallContext(req, modelSlug, "IMAGE");
  if ("error" in ctx && ctx.error) return ctx.error;
  const { key, model, discount, ip } = ctx as Exclude<typeof ctx, { error: NextResponse }>;

  const pricing = (model.pricingData as unknown) as ImagePricing | null;
  if (!pricing || !Array.isArray(pricing.matrix) || pricing.matrix.length === 0) {
    return err(400, `Model '${modelSlug}' chưa cấu hình giá. Báo admin set pricingData.`);
  }

  const { cost, matched } = computeImageCost(
    pricing,
    { size, quality, count: n },
    discount,
  );
  if (!matched) {
    return err(
      400,
      `Combo size=${size} × quality=${quality} không có trong bảng giá. Combo hỗ trợ: ${pricing.matrix.map(r => `${r.size}/${r.quality}`).join(", ")}.`,
    );
  }

  const unitsMeta = { size, quality, count: n };

  // Pre-check balance
  if (key.user.balance <= 0) {
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "IMAGE", unitsMeta, status: 402, ip });
    return err(402, `Số dư bằng 0. Nạp tại https://quangthuong-ai.vercel.app/topup.`, "insufficient_balance");
  }
  if (key.user.balance < cost) {
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "IMAGE", unitsMeta, status: 402, ip });
    return err(
      402,
      `Số dư không đủ (cần ${formatVND(cost)}, có ${formatVND(key.user.balance)}). Nạp tại https://quangthuong-ai.vercel.app/topup.`,
      "insufficient_balance",
    );
  }

  // Forward upstream
  let upstreamRes: Response;
  try {
    const { res } = await callWithFailover(model.slug, "images", async (u) => {
      const url = buildEndpointUrl(u.providerType, u.baseUrl, "images");
      return fetch(url, {
        method: "POST",
        headers: { ...authHeaders(u.providerType, u.apiKey), "Content-Type": "application/json" },
        body: JSON.stringify({
          model: u.upstreamModelSlug,
          prompt,
          size,
          quality,
          n,
        }),
      });
    });
    upstreamRes = res;
  } catch (e: any) {
    const status = e instanceof UpstreamError ? e.status : 502;
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "IMAGE", unitsMeta, status, ip });
    return err(status, e?.message || "Upstream image generation failed", "upstream_error");
  }

  if (!upstreamRes.ok) {
    const status = upstreamRes.status;
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "IMAGE", unitsMeta, status, ip });
    const body = await upstreamRes.text().catch(() => "");
    return err(status, `Upstream image generation lỗi ${status}. ${body.slice(0, 200)}`, "upstream_error");
  }

  const data = await upstreamRes.json().catch(() => null);

  // Re-check + charge
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
      modality: "IMAGE",
      unitsMeta,
      description: `${model.displayName} — ${n} ảnh ${size}/${quality} (API)`,
      ip,
    });
  } catch {
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "IMAGE", unitsMeta, status: 200, ip });
  }

  return NextResponse.json(data ?? { created: Math.floor(Date.now() / 1000), data: [] });
}
