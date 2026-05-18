// Admin API: list + create promo code.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizePromoCode } from "@/lib/promo";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["PERCENT", "FIXED"];

function parseDateOrNull(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(_req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
  return NextResponse.json(codes);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const code = normalizePromoCode(b.code);
  if (!code) return NextResponse.json({ error: "Thiếu code" }, { status: 400 });
  if (code.length < 3) return NextResponse.json({ error: "Code tối thiểu 3 ký tự" }, { status: 400 });

  const bonusType = ALLOWED_TYPES.includes(b.bonusType) ? b.bonusType : "PERCENT";
  const bonusPercent = Math.max(0, Number(b.bonusPercent) || 0);
  const bonusAmount = Math.max(0, Number(b.bonusAmount) || 0);
  if (bonusType === "PERCENT" && bonusPercent <= 0) {
    return NextResponse.json({ error: "Phần trăm bonus phải > 0" }, { status: 400 });
  }
  if (bonusType === "FIXED" && bonusAmount <= 0) {
    return NextResponse.json({ error: "Số tiền bonus phải > 0" }, { status: 400 });
  }

  try {
    const created = await prisma.promoCode.create({
      data: {
        code,
        description: b.description ? String(b.description).slice(0, 500) : null,
        bonusType,
        bonusPercent,
        bonusAmount,
        minAmount: Math.max(0, Number(b.minAmount) || 0),
        maxBonus: b.maxBonus != null && b.maxBonus !== "" ? Math.max(0, Number(b.maxBonus)) : null,
        firstUseOnly: !!b.firstUseOnly,
        enabled: b.enabled !== false,
        startsAt: parseDateOrNull(b.startsAt),
        expiresAt: parseDateOrNull(b.expiresAt),
        maxUses: b.maxUses != null && b.maxUses !== "" ? Math.max(0, Number(b.maxUses)) : null,
      },
    });
    return NextResponse.json(created);
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Code đã tồn tại" }, { status: 409 });
    return NextResponse.json({ error: e.message || "Có lỗi xảy ra" }, { status: 500 });
  }
}
