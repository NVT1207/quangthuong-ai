// One-click seed mã APIONDINH cho production. Idempotent — upsert.
// Gọi: POST /api/admin/promo-codes/seed-apiondinh (admin only)

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 25/5/2026 23:59:59 GMT+07 = 16:59:59 UTC
const EXPIRES_AT = new Date("2026-05-25T23:59:59+07:00");

export async function POST() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = {
    code: "APIONDINH",
    description: "Khuyến mãi mở khóa API Beeknoee — +10% bonus cho lần đầu nạp tối thiểu 3.000.000₫",
    bonusType: "PERCENT",
    bonusPercent: 10,
    bonusAmount: 0,
    minAmount: 3_000_000,
    maxBonus: null,
    firstUseOnly: true,
    enabled: true,
    startsAt: null,
    expiresAt: EXPIRES_AT,
    maxUses: null,
  };

  const code = await prisma.promoCode.upsert({
    where: { code: "APIONDINH" },
    update: data,
    create: data,
  });

  return NextResponse.json({
    ok: true,
    message: `Mã ${code.code} đã được tạo/cập nhật. Hết hạn: ${EXPIRES_AT.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`,
    code,
  });
}
