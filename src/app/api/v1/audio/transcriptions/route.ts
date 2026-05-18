// STT (Whisper-style) endpoint — OpenAI-compatible shape.
// Body: multipart/form-data với { file, model, language?, response_format? }
// Charge per-second sau khi upstream trả duration. Estimate pre-check theo filesize.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeSttCost, type SttPricing } from "@/lib/pricing";
import { formatVND } from "@/lib/format";
import { authHeaders, buildEndpointUrl, callWithFailover, UpstreamError } from "@/lib/provider-routing";
import { authenticate, getIp, getDiscount, chargeModality, logModalityError, err } from "@/lib/modality-route-helpers";
import { checkApiKeyRateLimit, RATE_LIMIT_PER_MIN } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Heuristic: mp3 ~1 phút ≈ 1MB. STT pre-check: estSec = size_bytes / 1024 / 1024 * 60.
function estimateSeconds(fileSize: number): number {
  return Math.max(1, (fileSize / (1024 * 1024)) * 60);
}

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return err(400, "Invalid multipart/form-data");
  }

  const file = formData.get("file");
  const modelSlug = (formData.get("model") as string) || "";
  const language = (formData.get("language") as string) || "";
  const responseFormat = (formData.get("response_format") as string) || "json";
  const prompt = (formData.get("prompt") as string) || "";
  const temperature = formData.get("temperature");

  if (!file || !(file instanceof Blob)) return err(400, "Missing 'file'");
  if (!modelSlug) return err(400, "Missing 'model'");

  // Auth + load model
  const key = await authenticate(req);
  if (!key) return err(401, "Invalid API key", "authentication_error");
  if (key.user.status === "BANNED") return err(403, "Account banned", "permission_error");
  const ip = getIp(req);
  const model = await prisma.model.findUnique({ where: { slug: modelSlug } });
  if (!model || !model.active) return err(404, `Model '${modelSlug}' not found`, "not_found_error");
  if (model.modality !== "AUDIO_STT") {
    return err(400, `Model '${modelSlug}' là ${model.modality} — không hỗ trợ STT.`);
  }

  const sub = await prisma.apiKeyModel.findUnique({
    where: { apiKeyId_modelId: { apiKeyId: key.id, modelId: model.id } },
    select: { enabled: true },
  });
  if (!sub || !sub.enabled) {
    return err(403, `API key chưa kích hoạt cho model '${modelSlug}'.`, "permission_error");
  }
  const rl = await checkApiKeyRateLimit(key.id);
  if (!rl.ok) return err(429, `Rate limit ${RATE_LIMIT_PER_MIN}/phút. Đợi 60s.`, "rate_limit_error");

  const pricing = (model.pricingData as unknown) as SttPricing | null;
  if (!pricing || !Number.isFinite(pricing.minuteRate)) {
    return err(400, `Model '${modelSlug}' chưa cấu hình giá. Báo admin set pricingData.minuteRate.`);
  }
  if (language && pricing.languages?.length && !pricing.languages.includes(language.toLowerCase())) {
    return err(400, `Language '${language}' không hỗ trợ. Languages: ${pricing.languages.join(", ")}.`);
  }

  const discount = getDiscount(key.user.tier, model);
  const fileSize = (file as any).size ?? 0;
  const estSeconds = estimateSeconds(fileSize);
  const estCost = computeSttCost(pricing, { seconds: estSeconds }, discount);
  const unitsMetaEst = { seconds: estSeconds, language, estimate: true };

  if (key.user.balance <= 0) {
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "AUDIO_STT", unitsMeta: unitsMetaEst, status: 402, ip });
    return err(402, `Số dư bằng 0. Nạp tại https://quangthuong-ai.vercel.app/topup.`, "insufficient_balance");
  }
  if (key.user.balance < estCost) {
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "AUDIO_STT", unitsMeta: unitsMetaEst, status: 402, ip });
    return err(
      402,
      `Số dư không đủ ước tính (file ${(fileSize / 1024 / 1024).toFixed(2)}MB ≈ ${estSeconds.toFixed(0)}s, cần ${formatVND(estCost)}, có ${formatVND(key.user.balance)}).`,
      "insufficient_balance",
    );
  }

  // Forward multipart upstream — phải dùng verbose_json để lấy duration cho billing chính xác.
  // Nếu user yêu cầu format khác, vẫn ép verbose_json upstream rồi adapt response.
  const wantedFormat = responseFormat;
  let upstreamRes: Response;
  try {
    const { res } = await callWithFailover(model.slug, "audio_transcriptions", async (u) => {
      const url = buildEndpointUrl(u.providerType, u.baseUrl, "audio_transcriptions");
      const fd = new FormData();
      fd.append("file", file as Blob, (file as any).name || "audio.mp3");
      fd.append("model", u.upstreamModelSlug);
      fd.append("response_format", "verbose_json");
      if (language) fd.append("language", language);
      if (prompt) fd.append("prompt", prompt);
      if (temperature) fd.append("temperature", String(temperature));
      return fetch(url, {
        method: "POST",
        headers: { ...authHeaders(u.providerType, u.apiKey) },
        body: fd,
      });
    });
    upstreamRes = res;
  } catch (e: any) {
    const status = e instanceof UpstreamError ? e.status : 502;
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "AUDIO_STT", unitsMeta: unitsMetaEst, status, ip });
    return err(status, e?.message || "Upstream STT failed", "upstream_error");
  }

  if (!upstreamRes.ok) {
    const status = upstreamRes.status;
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "AUDIO_STT", unitsMeta: unitsMetaEst, status, ip });
    const body = await upstreamRes.text().catch(() => "");
    return err(status, `Upstream STT lỗi ${status}. ${body.slice(0, 200)}`, "upstream_error");
  }

  const data: any = await upstreamRes.json().catch(() => null);
  const actualSeconds = Number(data?.duration) || estSeconds;
  const actualCost = computeSttCost(pricing, { seconds: actualSeconds }, discount);
  const unitsMeta = { seconds: actualSeconds, language: data?.language ?? language };

  const fresh = await prisma.user.findUnique({ where: { id: key.userId } });
  const balance = fresh?.balance ?? key.user.balance;
  const charge = Math.min(actualCost, balance);
  try {
    await chargeModality({
      userId: key.userId,
      apiKeyId: key.id,
      balance,
      cost: charge,
      modelSlug: model.slug,
      modelName: model.displayName,
      modality: "AUDIO_STT",
      unitsMeta,
      description: `${model.displayName} — STT ${actualSeconds.toFixed(1)}s (API)`,
      ip,
    });
  } catch {
    await logModalityError({ userId: key.userId, apiKeyId: key.id, modelSlug: model.slug, modality: "AUDIO_STT", unitsMeta, status: 200, ip });
  }

  // Adapt response theo wantedFormat
  if (wantedFormat === "text") {
    return new Response(data?.text ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  if (wantedFormat === "verbose_json") {
    return NextResponse.json(data);
  }
  // Default "json" hoặc unknown → { text }
  return NextResponse.json({ text: data?.text ?? "" });
}
