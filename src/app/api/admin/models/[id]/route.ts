import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptKey, isCipherConfigured } from "@/lib/key-cipher";

const ALLOWED_PROVIDER_TYPES = ["OPENAI", "ANTHROPIC", "GEMINI", "OLLAMA", "OPENAI_COMPATIBLE"];
const ALLOWED_ROUTING = ["ROUND_ROBIN", "FAILOVER", "RANDOM", "LEAST_USED"];

async function createInlineProvider(np: any): Promise<string> {
  if (!isCipherConfigured()) throw new Error("KEY_ENCRYPTION_KEY chưa cấu hình.");
  if (!np.name) throw new Error("Provider thiếu tên");
  if (!ALLOWED_PROVIDER_TYPES.includes(np.type)) throw new Error("Loại provider không hợp lệ");
  const routing = ALLOWED_ROUTING.includes(np.routing) ? np.routing : "ROUND_ROBIN";
  let baseUrl: string | null = null;
  if (typeof np.baseUrl === "string" && np.baseUrl.trim()) baseUrl = np.baseUrl.trim().replace(/\/+$/, "");
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
      type: np.type, baseUrl, routing,
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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json();
  const data: any = {};
  if (b.displayName) data.displayName = String(b.displayName);
  if (b.provider) data.provider = String(b.provider);
  if (b.slug) data.slug = String(b.slug).trim();
  if (b.category && ["text", "embedding", "image", "video", "tts"].includes(b.category)) data.category = b.category;
  if (b.priceUnit !== undefined) data.priceUnit = String(b.priceUnit || "1M tokens");
  if (b.inputPrice !== undefined) data.inputPrice = Number(b.inputPrice);
  if (b.outputPrice !== undefined) data.outputPrice = Number(b.outputPrice);
  if (b.contextLength !== undefined) data.contextLength = Number(b.contextLength);
  if (b.description !== undefined) data.description = b.description;
  if (b.active !== undefined) data.active = !!b.active;
  if (b.freeDiscount !== undefined) data.freeDiscount = Number(b.freeDiscount) || 0;
  if (b.basicDiscount !== undefined) data.basicDiscount = Number(b.basicDiscount) || 0;
  if (b.advDiscount !== undefined) data.advDiscount = Number(b.advDiscount) || 0;
  if (b.speedTps !== undefined) data.speedTps = Number(b.speedTps) || 0;
  if (b.latencyMs !== undefined) data.latencyMs = Number(b.latencyMs) || 0;
  if (b.uptimeStatus !== undefined && ["good", "warn", "down"].includes(b.uptimeStatus)) data.uptimeStatus = b.uptimeStatus;
  if (b.upstreamSlug !== undefined) data.upstreamSlug = b.upstreamSlug ? String(b.upstreamSlug).trim() : null;

  // Provider handling: hoặc set providerId từ dropdown, hoặc tạo inline
  if (b.newProvider && typeof b.newProvider === "object") {
    try {
      data.providerId = await createInlineProvider(b.newProvider);
    } catch (e: any) {
      return NextResponse.json({ error: `Lỗi tạo provider: ${e?.message || e}` }, { status: 400 });
    }
  } else if (b.providerId !== undefined) {
    data.providerId = b.providerId ? String(b.providerId) : null;
  }

  const m = await prisma.model.update({ where: { id: params.id }, data });
  return NextResponse.json(m);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.model.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
