// GET /api/keys/[id]/reveal — trả full key (decrypt từ encryptedKey).
// Chỉ owner mới được gọi. Yêu cầu KEY_ENCRYPTION_KEY đã cấu hình.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptKey, isCipherConfigured } from "@/lib/key-cipher";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isCipherConfigured()) {
    return NextResponse.json(
      { error: "Server chưa cấu hình KEY_ENCRYPTION_KEY — không thể reveal key." },
      { status: 503 },
    );
  }

  const key = await prisma.apiKey.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, encryptedKey: true, revokedAt: true },
  });
  if (!key || key.userId !== session.user.id || key.revokedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!key.encryptedKey) {
    // Key cũ tạo trước khi có encryptedKey → không thể recover.
    return NextResponse.json(
      { error: "Key này được tạo trước khi bật mã hoá. Hãy tạo key mới." },
      { status: 410 },
    );
  }

  try {
    const fullKey = decryptKey(key.encryptedKey);
    return NextResponse.json({ fullKey });
  } catch (e: any) {
    return NextResponse.json({ error: "Không giải mã được key." }, { status: 500 });
  }
}
