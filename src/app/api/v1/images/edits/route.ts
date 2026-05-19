// Image edit (image-to-image) endpoint — OpenAI-compatible shape.
// Request: multipart/form-data
//   - image: 1 file HOẶC nhiều file (image, image[]) — tối đa 4 ảnh ref
//   - mask:  (optional) 1 file PNG cùng size với image[0] để inpaint
//   - model: string (vd "gpt-image-2")
//   - prompt: string
//   - size: "1024x1024" | "1024x1536" | "1536x1024"
//   - quality: "low" | "medium" | "high"
//   - n: số ảnh muốn gen (default 1, max 10)
// Charge per-image theo matrix size × quality (giống endpoint generations).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeImageCost, type ImagePricing } from "@/lib/pricing";
import { formatVND } from "@/lib/format";
import { authHeaders, buildEndpointUrl, callWithFailover, UpstreamError } from "@/lib/provider-routing";
import { loadCallContext, chargeModality, logModalityError, err } from "@/lib/modality-route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 180; // image-edit nhận tới 4 ảnh ref → cần lâu hơn generations

export async function POST(req: Request) {
  // Parse multipart
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err(400, "Request phải là multipart/form-data (image, prompt, model, ...).");
  }

  const modelSlug = typeof form.get("model") === "string" ? (form.get("model") as string) : "";
  const prompt = typeof form.get("prompt") === "string" ? (form.get("prompt") as string).trim() : "";
  const size = typeof form.get("size") === "string" ? (form.get("size") as string) : "1024x1024";
  const quality = typeof form.get("quality") === "string" ? (form.get("quality") as string) : "auto";
  const n = Math.max(1, Math.min(10, Number(form.get("n")) || 1));

  if (!prompt) return err(400, "Missing 'prompt'");

  // Collect image files: chấp nhận cả 'image' (lặp lại) và 'image[]'
  const rawImages: File[] = [];
  for (const key of ["image", "image[]"]) {
    for (const v of form.getAll(key)) {
      if (v instanceof File && v.size > 0) rawImages.push(v);
    }
  }
  if (rawImages.length === 0) return err(400, "Thiếu file ảnh — gửi field 'image' (file PNG/JPG).");
  if (rawImages.length > 4) return err(400, `Tối đa 4 ảnh reference, đang nhận ${rawImages.length}.`);

  // Validate kích thước (OpenAI giới hạn 25MB/ảnh)
  const MAX_BYTES = 25 * 1024 * 1024;
  for (const f of rawImages) {
    if (f.size > MAX_BYTES) {
      return err(400, `Ảnh '${f.name}' vượt 25MB (${(f.size / 1048576).toFixed(1)}MB).`);
    }
  }

  const maskFile = form.get("mask");
  const mask = maskFile instanceof File && maskFile.size > 0 ? maskFile : null;
  if (mask && mask.size > MAX_BYTES) {
    return err(400, `Mask '${mask.name}' vượt 25MB.`);
  }

  // Auth + load context
  const ctx = await loadCallContext(req, modelSlug, "IMAGE");
  if ("error" in ctx && ctx.error) return ctx.error;
  const { key, model, discount, ip } = ctx as Exclude<typeof ctx, { error: NextResponse }>;

  // Pricing
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

  const unitsMeta = { size, quality, count: n, refs: rawImages.length, mask: !!mask };

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

  // Forward upstream với multipart FormData
  let upstreamRes: Response;
  try {
    const { res } = await callWithFailover(model.slug, "images_edit", async (u) => {
      const url = buildEndpointUrl(u.providerType, u.imagesBaseUrl ?? u.baseUrl, "images_edit");

      // Build FormData mới với upstreamModelSlug (admin có thể map slug nội bộ → slug thực)
      const upstream = new FormData();
      upstream.set("model", u.upstreamModelSlug);
      upstream.set("prompt", prompt);
      upstream.set("size", size);
      upstream.set("quality", quality);
      upstream.set("n", String(n));
      for (const f of rawImages) {
        upstream.append("image", f, f.name);
      }
      if (mask) upstream.append("mask", mask, mask.name);

      // KHÔNG set Content-Type — fetch tự sinh boundary cho multipart
      return fetch(url, {
        method: "POST",
        headers: authHeaders(u.providerType, u.apiKey),
        body: upstream,
      });
    });
    upstreamRes = res;
  } catch (e: any) {
    const status = e instanceof UpstreamError ? e.status : 502;
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "IMAGE", unitsMeta, status, ip });
    return err(status, e?.message || "Upstream image edit failed", "upstream_error");
  }

  if (!upstreamRes.ok) {
    const status = upstreamRes.status;
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "IMAGE", unitsMeta, status, ip });
    const body = await upstreamRes.text().catch(() => "");
    return err(status, `Upstream image edit lỗi ${status}. ${body.slice(0, 200)}`, "upstream_error");
  }

  const data = await upstreamRes.json().catch(() => null);

  // Re-check + charge (giống pattern generations)
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
      description: `${model.displayName} — ${n} ảnh edit ${size}/${quality} (${rawImages.length} ref${mask ? "+mask" : ""})`,
      ip,
    });
  } catch {
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "IMAGE", unitsMeta, status: 200, ip });
  }

  return NextResponse.json(data ?? { created: Math.floor(Date.now() / 1000), data: [] });
}
