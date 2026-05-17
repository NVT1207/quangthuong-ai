import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptKey, isCipherConfigured, getCipherStatus } from "@/lib/key-cipher";

const ALLOWED_PROVIDERS = ["openai", "anthropic", "google", "deepseek", "grok", "meta", "mistral", "other"];
const ALLOWED_UPTIME = ["good", "warn", "down"];
const ALLOWED_CATEGORIES = ["text", "embedding", "image", "video", "tts"];
const ALLOWED_PROVIDER_TYPES = ["OPENAI", "ANTHROPIC", "GEMINI", "OLLAMA", "OPENAI_COMPATIBLE"];
const ALLOWED_ROUTING = ["ROUND_ROBIN", "FAILOVER", "RANDOM", "LEAST_USED"];

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  if (url.searchParams.get("all") !== "1") {
    return NextResponse.json({ error: "Thiếu ?all=1 để xác nhận bulk delete" }, { status: 400 });
  }
  // UsageLog dùng modelSlug (string), không FK → an toàn xóa Model.
  const r = await prisma.model.deleteMany({});
  return NextResponse.json({ ok: true, deleted: r.count });
}

// Tạo Provider inline (khi admin chọn "Tạo provider mới" trong modal Model)
// Trả providerId để gắn vào Model.
async function createInlineProvider(np: any): Promise<string> {
  const cs = getCipherStatus();
  if (!cs.ok) {
    if (cs.reason === "missing") throw new Error("KEY_ENCRYPTION_KEY chưa được set trên Vercel. Vào Settings → Environment Variables → add biến rồi Redeploy.");
    if (cs.reason === "invalid_base64") throw new Error("KEY_ENCRYPTION_KEY không phải base64 hợp lệ. Sinh lại: openssl rand -base64 32");
    if (cs.reason === "invalid_length") throw new Error(`KEY_ENCRYPTION_KEY phải là 32 bytes (base64), hiện ${cs.got} bytes. Sinh lại: openssl rand -base64 32`);
  }
  if (!np.name || typeof np.name !== "string") throw new Error("Provider thiếu tên");
  if (!ALLOWED_PROVIDER_TYPES.includes(np.type)) throw new Error("Loại provider không hợp lệ");
  const routing = ALLOWED_ROUTING.includes(np.routing) ? np.routing : "ROUND_ROBIN";
  let baseUrl: string | null = null;
  if (typeof np.baseUrl === "string" && np.baseUrl.trim()) {
    baseUrl = np.baseUrl.trim().replace(/\/+$/, "");
  }
  if ((np.type === "OPENAI_COMPATIBLE" || np.type === "OLLAMA") && !baseUrl) {
    throw new Error(`Provider loại ${np.type} cần baseUrl`);
  }
  const rawKeys: string[] = Array.isArray(np.keys)
    ? np.keys.filter((k: any) => typeof k === "string" && k.trim())
    : [];
  if (rawKeys.length === 0) throw new Error("Provider cần ít nhất 1 API key");

  const created = await prisma.provider.create({
    data: {
      name: String(np.name).trim(),
      description: np.description ? String(np.description) : null,
      type: np.type,
      baseUrl,
      routing,
      enabled: np.enabled !== false,
      keys: {
        create: rawKeys.map((k, i) => ({
          encryptedKey: encryptKey(k.trim()),
          prefix: k.trim().slice(0, 8),
          label: np.keyLabels?.[i] || `Key ${i + 1}`,
        })),
      },
    },
  });
  return created.id;
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

  // Inline provider creation (optional)
  let providerId: string | null = b.providerId ? String(b.providerId) : null;
  if (b.newProvider && typeof b.newProvider === "object") {
    try {
      providerId = await createInlineProvider(b.newProvider);
    } catch (e: any) {
      return NextResponse.json({ error: `Lỗi tạo provider: ${e?.message || e}` }, { status: 400 });
    }
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
        providerId,
        upstreamSlug: b.upstreamSlug ? String(b.upstreamSlug).trim() : null,
      },
    });
    return NextResponse.json(m);
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Slug đã tồn tại" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
