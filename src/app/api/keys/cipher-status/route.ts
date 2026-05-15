// GET /api/keys/cipher-status — debug endpoint cho user đã đăng nhập.
// Trả lý do cụ thể KEY_ENCRYPTION_KEY có hợp lệ hay không (không leak value thật).
// Dùng để chẩn đoán nhanh khi reveal key báo "chưa cấu hình".

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCipherStatus } from "@/lib/key-cipher";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = getCipherStatus();
  const raw = process.env.KEY_ENCRYPTION_KEY;
  return NextResponse.json({
    status,
    envPresent: typeof raw === "string",
    envEmpty: !raw || !raw.trim(),
    rawLength: raw?.length ?? 0,
    trimmedLength: raw?.trim().length ?? 0,
    hasWhitespaceEdges: !!raw && raw !== raw.trim(),
    nodeVersion: process.version,
    runtime: process.env.NEXT_RUNTIME ?? "node",
    region: process.env.VERCEL_REGION ?? null,
  });
}
