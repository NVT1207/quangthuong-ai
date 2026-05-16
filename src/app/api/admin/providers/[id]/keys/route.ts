import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptKey, isCipherConfigured } from "@/lib/key-cipher";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isCipherConfigured()) {
    return NextResponse.json({ error: "KEY_ENCRYPTION_KEY chưa cấu hình." }, { status: 500 });
  }

  const b = await req.json();
  const rawKeys: string[] = Array.isArray(b.keys)
    ? b.keys.filter((k: any) => typeof k === "string" && k.trim())
    : typeof b.key === "string" && b.key.trim() ? [b.key.trim()] : [];
  if (rawKeys.length === 0) return NextResponse.json({ error: "Thiếu API key" }, { status: 400 });

  const provider = await prisma.provider.findUnique({ where: { id: params.id } });
  if (!provider) return NextResponse.json({ error: "Provider không tồn tại" }, { status: 404 });

  try {
    const created = await prisma.providerKey.createMany({
      data: rawKeys.map((k, i) => ({
        providerId: params.id,
        encryptedKey: encryptKey(k.trim()),
        prefix: k.trim().slice(0, 8),
        label: b.labels?.[i] || b.label || null,
      })),
    });
    return NextResponse.json({ ok: true, count: created.count });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi tạo key" }, { status: 500 });
  }
}
