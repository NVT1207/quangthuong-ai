// Admin API: update + delete promo code.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["PERCENT", "FIXED"];

function parseDateOrNull(v: any): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const data: any = {};

  if (b.description !== undefined) {
    data.description = b.description ? String(b.description).slice(0, 500) : null;
  }
  if (b.bonusType !== undefined) {
    if (!ALLOWED_TYPES.includes(b.bonusType)) {
      return NextResponse.json({ error: "bonusType không hợp lệ" }, { status: 400 });
    }
    data.bonusType = b.bonusType;
  }
  if (b.bonusPercent !== undefined) data.bonusPercent = Math.max(0, Number(b.bonusPercent) || 0);
  if (b.bonusAmount !== undefined) data.bonusAmount = Math.max(0, Number(b.bonusAmount) || 0);
  if (b.minAmount !== undefined) data.minAmount = Math.max(0, Number(b.minAmount) || 0);
  if (b.maxBonus !== undefined) {
    data.maxBonus = b.maxBonus === null || b.maxBonus === "" ? null : Math.max(0, Number(b.maxBonus));
  }
  if (b.firstUseOnly !== undefined) data.firstUseOnly = !!b.firstUseOnly;
  if (b.enabled !== undefined) data.enabled = !!b.enabled;
  if (b.maxUses !== undefined) {
    data.maxUses = b.maxUses === null || b.maxUses === "" ? null : Math.max(0, Number(b.maxUses));
  }
  const startsAt = parseDateOrNull(b.startsAt);
  if (startsAt !== undefined) data.startsAt = startsAt;
  const expiresAt = parseDateOrNull(b.expiresAt);
  if (expiresAt !== undefined) data.expiresAt = expiresAt;

  try {
    const updated = await prisma.promoCode.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.code === "P2025") return NextResponse.json({ error: "Không tìm thấy mã" }, { status: 404 });
    return NextResponse.json({ error: e.message || "Có lỗi xảy ra" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await prisma.promoCode.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.code === "P2025") return NextResponse.json({ error: "Không tìm thấy mã" }, { status: 404 });
    return NextResponse.json({ error: e.message || "Có lỗi xảy ra" }, { status: 500 });
  }
}
