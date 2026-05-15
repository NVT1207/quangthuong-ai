// Endpoint nhẹ để statusline script Claude Code query balance + tier hiện tại.
// Auth bằng sk-bee-... (giống các endpoint /v1/* khác). Trả JSON gọn.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyKey } from "@/lib/api-key";

export const dynamic = "force-dynamic";

async function authenticate(req: Request) {
  let token = "";
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) token = auth.slice(7);
  else token = req.headers.get("x-api-key") || "";
  if (!token.startsWith("sk-bee-")) return null;
  const prefix = token.slice(0, 11);
  const candidates = await prisma.apiKey.findMany({
    where: { prefix, revokedAt: null, enabled: true },
    include: { user: true },
  });
  for (const k of candidates) {
    if (await verifyKey(token, k.keyHash)) return k;
  }
  return null;
}

export async function GET(req: Request) {
  const key = await authenticate(req);
  if (!key) {
    return NextResponse.json(
      { error: { type: "authentication_error", message: "Invalid API key" } },
      { status: 401 },
    );
  }
  return NextResponse.json({
    email: key.user.email,
    name: key.user.name,
    tier: key.user.tier,
    balance: key.user.balance,
    currency: "VND",
  });
}
