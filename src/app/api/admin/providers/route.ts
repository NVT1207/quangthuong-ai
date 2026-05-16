import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptKey, isCipherConfigured } from "@/lib/key-cipher";

const ALLOWED_TYPES = ["OPENAI", "ANTHROPIC", "GEMINI", "OLLAMA", "OPENAI_COMPATIBLE"];
const ALLOWED_ROUTING = ["ROUND_ROBIN", "FAILOVER", "RANDOM", "LEAST_USED"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const providers = await prisma.provider.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      keys: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, prefix: true, label: true, enabled: true,
          lastUsedAt: true, lastErrorAt: true, errorCount: true,
          totalRequests: true, totalErrors: true, createdAt: true,
        },
      },
      _count: { select: { models: true } },
    },
  });
  return NextResponse.json(providers);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isCipherConfigured()) {
    return NextResponse.json({ error: "KEY_ENCRYPTION_KEY chưa cấu hình. Sinh: openssl rand -base64 32" }, { status: 500 });
  }

  const b = await req.json();
  if (!b.name || typeof b.name !== "string") return NextResponse.json({ error: "Thiếu tên provider" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(b.type)) return NextResponse.json({ error: "Loại provider không hợp lệ" }, { status: 400 });
  const routing = ALLOWED_ROUTING.includes(b.routing) ? b.routing : "ROUND_ROBIN";

  // BaseURL bắt buộc cho COMPATIBLE/OLLAMA
  let baseUrl: string | null = null;
  if (typeof b.baseUrl === "string" && b.baseUrl.trim()) baseUrl = b.baseUrl.trim().replace(/\/+$/, "");
  if ((b.type === "OPENAI_COMPATIBLE" || b.type === "OLLAMA") && !baseUrl) {
    return NextResponse.json({ error: `Provider loại ${b.type} cần baseUrl` }, { status: 400 });
  }

  const rawKeys: string[] = Array.isArray(b.keys) ? b.keys.filter((k: any) => typeof k === "string" && k.trim()) : [];
  if (rawKeys.length === 0) return NextResponse.json({ error: "Cần ít nhất 1 API key" }, { status: 400 });

  try {
    const provider = await prisma.provider.create({
      data: {
        name: String(b.name).trim(),
        description: b.description ? String(b.description) : null,
        type: b.type,
        baseUrl,
        routing,
        enabled: b.enabled !== false,
        keys: {
          create: rawKeys.map((k, i) => ({
            encryptedKey: encryptKey(k.trim()),
            prefix: k.trim().slice(0, 8),
            label: b.keyLabels?.[i] || `Key ${i + 1}`,
          })),
        },
      },
      include: { keys: true, _count: { select: { models: true } } },
    });
    return NextResponse.json(provider);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi tạo provider" }, { status: 500 });
  }
}
