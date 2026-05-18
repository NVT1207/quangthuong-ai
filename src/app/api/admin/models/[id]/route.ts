import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptKey, getCipherStatus } from "@/lib/key-cipher";
import { Prisma } from "@prisma/client";
import { MODALITIES, validatePricingData } from "@/lib/pricing";

const ALLOWED_API_TYPES = ["OPENAI", "ANTHROPIC", "GEMINI", "OLLAMA", "OPENAI_COMPATIBLE"];
const API_TYPES_NEED_BASEURL = new Set(["OLLAMA", "OPENAI_COMPATIBLE"]);

function ensureCipherReady() {
  const cs = getCipherStatus();
  if (cs.ok) return;
  if (cs.reason === "missing") throw new Error("KEY_ENCRYPTION_KEY chưa được set trên Vercel.");
  if (cs.reason === "invalid_base64") throw new Error("KEY_ENCRYPTION_KEY không phải base64 hợp lệ.");
  if (cs.reason === "invalid_length") throw new Error(`KEY_ENCRYPTION_KEY phải là 32 bytes (base64), hiện ${cs.got} bytes.`);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json();
  const data: any = {};
  if (b.displayName) data.displayName = String(b.displayName);
  if (b.provider) data.provider = String(b.provider);
  if (b.slug) data.slug = String(b.slug).trim();
  if (b.category && ["text", "embedding", "image", "video", "tts", "stt"].includes(b.category)) data.category = b.category;
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

  // === Modality + pricingData ===
  // 3 case:
  //  - chỉ update modality → revalidate pricingData hiện tại trong DB nếu cần (nhưng client luôn gửi kèm), nên đơn giản: yêu cầu gửi kèm khi đổi modality.
  //  - chỉ update pricingData → cần biết modality để validate → load DB nếu client không gửi.
  //  - update cả 2 → validate trực tiếp.
  let modalityForValidate: string | null = null;
  if (b.modality !== undefined) {
    if (!MODALITIES.includes(b.modality)) {
      return NextResponse.json({ error: "modality không hợp lệ" }, { status: 400 });
    }
    modalityForValidate = b.modality;
    data.modality = b.modality;
  }
  if (b.pricingData !== undefined) {
    let mod = modalityForValidate;
    if (!mod) {
      const current = await prisma.model.findUnique({ where: { id: params.id }, select: { modality: true } });
      mod = current?.modality ?? "TEXT";
    }
    const validated = validatePricingData(mod, b.pricingData);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
    data.pricingData = validated.data === null ? Prisma.JsonNull : validated.data;
  } else if (b.modality !== undefined && (b.modality === "TEXT" || b.modality === "EMBEDDING")) {
    // Khi chuyển về TEXT/EMBEDDING mà client không gửi pricingData → tự reset null.
    data.pricingData = Prisma.JsonNull;
  }

  // === API config ===
  if (b.apiType !== undefined) {
    if (!ALLOWED_API_TYPES.includes(b.apiType)) return NextResponse.json({ error: "apiType không hợp lệ" }, { status: 400 });
    data.apiType = b.apiType;
  }
  if (b.apiBaseUrl !== undefined) {
    if (b.apiBaseUrl === null || b.apiBaseUrl === "") data.apiBaseUrl = null;
    else data.apiBaseUrl = String(b.apiBaseUrl).trim().replace(/\/+$/, "");
  }
  // Chỉ encrypt + lưu key mới nếu admin nhập (chuỗi khác rỗng). Nếu rỗng/undefined → giữ key cũ.
  if (typeof b.apiKey === "string" && b.apiKey.trim()) {
    try { ensureCipherReady(); } catch (e: any) {
      return NextResponse.json({ error: e?.message }, { status: 500 });
    }
    const raw = b.apiKey.trim();
    data.apiKeyEnc = encryptKey(raw);
    data.apiKeyPrefix = raw.slice(0, 8);
  } else if (b.apiKey === null) {
    // Cho phép admin set null để xóa key
    data.apiKeyEnc = null;
    data.apiKeyPrefix = null;
  }

  // Validate baseUrl required cho OLLAMA/OPENAI_COMPATIBLE
  if (data.apiType && API_TYPES_NEED_BASEURL.has(data.apiType)) {
    const finalBaseUrl = data.apiBaseUrl !== undefined ? data.apiBaseUrl : null;
    // Cần check DB nếu không update apiBaseUrl
    if (data.apiBaseUrl === undefined) {
      const current = await prisma.model.findUnique({ where: { id: params.id }, select: { apiBaseUrl: true } });
      if (!current?.apiBaseUrl) {
        return NextResponse.json({ error: `Loại API ${data.apiType} cần Base URL` }, { status: 400 });
      }
    } else if (!finalBaseUrl) {
      return NextResponse.json({ error: `Loại API ${data.apiType} cần Base URL` }, { status: 400 });
    }
  }

  try {
    const m = await prisma.model.update({ where: { id: params.id }, data });
    return NextResponse.json(m);
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Slug đã tồn tại" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.model.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
