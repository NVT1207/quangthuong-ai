import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptKey, getCipherStatus } from "@/lib/key-cipher";
import { MODALITIES, validatePricingData } from "@/lib/pricing";

const ALLOWED_PROVIDERS = ["openai", "anthropic", "google", "deepseek", "grok", "meta", "mistral", "other"];
const ALLOWED_UPTIME = ["good", "warn", "down"];
const ALLOWED_CATEGORIES = ["text", "embedding", "image", "video", "tts", "stt"];
const ALLOWED_API_TYPES = ["OPENAI", "ANTHROPIC", "GEMINI", "OLLAMA", "OPENAI_COMPATIBLE"];

const API_TYPES_NEED_BASEURL = new Set(["OLLAMA", "OPENAI_COMPATIBLE"]);

function ensureCipherReady() {
  const cs = getCipherStatus();
  if (cs.ok) return;
  if (cs.reason === "missing") throw new Error("KEY_ENCRYPTION_KEY chưa được set trên Vercel. Vào Settings → Environment Variables → add biến rồi Redeploy.");
  if (cs.reason === "invalid_base64") throw new Error("KEY_ENCRYPTION_KEY không phải base64 hợp lệ. Sinh lại: openssl rand -base64 32");
  if (cs.reason === "invalid_length") throw new Error(`KEY_ENCRYPTION_KEY phải là 32 bytes (base64), hiện ${cs.got} bytes. Sinh lại: openssl rand -base64 32`);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  if (url.searchParams.get("all") !== "1") {
    return NextResponse.json({ error: "Thiếu ?all=1 để xác nhận bulk delete" }, { status: 400 });
  }
  const r = await prisma.model.deleteMany({});
  return NextResponse.json({ ok: true, deleted: r.count });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json();
  if (!b.slug || !b.displayName) return NextResponse.json({ error: "Thiếu slug/tên" }, { status: 400 });
  if (!ALLOWED_PROVIDERS.includes(b.provider)) return NextResponse.json({ error: "Provider không hợp lệ" }, { status: 400 });
  const uptime = ALLOWED_UPTIME.includes(b.uptimeStatus) ? b.uptimeStatus : "good";
  const category = ALLOWED_CATEGORIES.includes(b.category) ? b.category : "text";
  const priceUnit = typeof b.priceUnit === "string" && b.priceUnit.trim() ? b.priceUnit.trim() : "1M tokens";

  // === Modality + pricingData ===
  const modality = MODALITIES.includes(b.modality) ? b.modality : "TEXT";
  const validated = validatePricingData(modality, b.pricingData ?? null);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const pricingData = validated.data;

  // === API config ===
  const apiType = ALLOWED_API_TYPES.includes(b.apiType) ? b.apiType : "OPENAI_COMPATIBLE";
  let apiBaseUrl: string | null = null;
  if (typeof b.apiBaseUrl === "string" && b.apiBaseUrl.trim()) {
    apiBaseUrl = b.apiBaseUrl.trim().replace(/\/+$/, "");
  }
  if (API_TYPES_NEED_BASEURL.has(apiType) && !apiBaseUrl) {
    return NextResponse.json({ error: `Loại API ${apiType} cần Base URL` }, { status: 400 });
  }
  let apiBaseUrlImages: string | null = null;
  if (typeof b.apiBaseUrlImages === "string" && b.apiBaseUrlImages.trim()) {
    apiBaseUrlImages = b.apiBaseUrlImages.trim().replace(/\/+$/, "");
  }

  let apiKeyEnc: string | null = null;
  let apiKeyPrefix: string | null = null;
  if (typeof b.apiKey === "string" && b.apiKey.trim()) {
    try { ensureCipherReady(); } catch (e: any) {
      return NextResponse.json({ error: e?.message || "Cipher chưa cấu hình" }, { status: 500 });
    }
    const rawKey = b.apiKey.trim();
    apiKeyEnc = encryptKey(rawKey);
    apiKeyPrefix = rawKey.slice(0, 8);
  }

  try {
    const m = await prisma.model.create({
      data: {
        slug: String(b.slug).trim(),
        displayName: String(b.displayName).trim(),
        provider: b.provider,
        category,
        priceUnit,
        inputPrice: Number(b.inputPrice) || 0,
        outputPrice: Number(b.outputPrice) || 0,
        contextLength: Number(b.contextLength) || 0,
        description: b.description || null,
        active: b.active !== false,
        freeDiscount: Number(b.freeDiscount) || 0,
        basicDiscount: Number(b.basicDiscount) || 0,
        advDiscount: Number(b.advDiscount) || 0,
        speedTps: Number(b.speedTps) || 0,
        latencyMs: Number(b.latencyMs) || 0,
        uptimeStatus: uptime,
        apiType,
        apiBaseUrl,
        apiBaseUrlImages,
        apiKeyEnc,
        apiKeyPrefix,
        upstreamSlug: b.upstreamSlug ? String(b.upstreamSlug).trim() : null,
        modality,
        ...(pricingData !== null ? { pricingData } : {}),
      },
    });
    return NextResponse.json(m);
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Slug đã tồn tại" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
