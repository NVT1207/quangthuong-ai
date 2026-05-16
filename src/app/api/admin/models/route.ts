import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_PROVIDERS = ["openai", "anthropic", "google", "deepseek", "grok", "meta", "mistral", "other"];
const ALLOWED_UPTIME = ["good", "warn", "down"];
const ALLOWED_CATEGORIES = ["text", "embedding", "image", "video", "tts"];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json();
  if (!b.slug || !b.displayName) return NextResponse.json({ error: "Thiếu slug/tên" }, { status: 400 });
  if (!ALLOWED_PROVIDERS.includes(b.provider)) return NextResponse.json({ error: "Provider không hợp lệ" }, { status: 400 });
  const uptime = ALLOWED_UPTIME.includes(b.uptimeStatus) ? b.uptimeStatus : "good";
  const category = ALLOWED_CATEGORIES.includes(b.category) ? b.category : "text";
  const priceUnit = typeof b.priceUnit === "string" && b.priceUnit.trim() ? b.priceUnit.trim() : "1M tokens";
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
        providerId: b.providerId ? String(b.providerId) : null,
        upstreamSlug: b.upstreamSlug ? String(b.upstreamSlug).trim() : null,
      },
    });
    return NextResponse.json(m);
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Slug đã tồn tại" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
