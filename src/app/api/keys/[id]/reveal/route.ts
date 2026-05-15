// GET /api/keys/[id]/reveal — trả full key (decrypt từ encryptedKey).
// Chỉ owner mới được gọi. Yêu cầu KEY_ENCRYPTION_KEY đã cấu hình.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptKey, getCipherStatus } from "@/lib/key-cipher";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = getCipherStatus();
  if (!status.ok) {
    const detail =
      status.reason === "missing"
        ? "Server chưa set env KEY_ENCRYPTION_KEY. Anh thêm vào Vercel → Settings → Environment Variables (32 bytes base64), tick cả Production, rồi Redeploy."
        : status.reason === "invalid_base64"
          ? "KEY_ENCRYPTION_KEY trong env không phải base64 hợp lệ. Sinh lại bằng: openssl rand -base64 32"
          : `KEY_ENCRYPTION_KEY phải là 32 bytes (256-bit) base64, env hiện decode ra ${status.got} bytes. Sinh lại bằng: openssl rand -base64 32`;
    return NextResponse.json({ error: detail, reason: status.reason }, { status: 503 });
  }

  const key = await prisma.apiKey.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, encryptedKey: true, revokedAt: true },
  });
  if (!key || key.userId !== session.user.id || key.revokedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!key.encryptedKey) {
    return NextResponse.json(
      { error: "Key này được tạo trước khi bật mã hoá. Hãy tạo key mới." },
      { status: 410 },
    );
  }

  try {
    const fullKey = decryptKey(key.encryptedKey);
    return NextResponse.json({ fullKey });
  } catch (e: any) {
    return NextResponse.json({ error: "Không giải mã được key. Có thể KEK đã đổi sau khi key được tạo." }, { status: 500 });
  }
}
