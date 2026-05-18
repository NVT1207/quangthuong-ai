import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { BANK_INFO, buildVietQrUrl, topupBonus } from "@/lib/topup";
import { normalizePromoCode, validatePromoCode } from "@/lib/promo";

const VALID_METHODS = ["qr", "bank", "momo"];

function generateReference() {
  return "QT" + randomBytes(3).toString("hex").toUpperCase();
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const amount = Number(body.amount);
  const method = String(body.method || "qr").toLowerCase();
  const promoCode = normalizePromoCode(body.promoCode);
  const note = body.note ? String(body.note).slice(0, 300) : null;

  if (!amount || amount < 20000) return NextResponse.json({ error: "Số tiền tối thiểu 20.000₫" }, { status: 400 });
  if (amount > 500_000_000) return NextResponse.json({ error: "Số tiền tối đa 500.000.000₫" }, { status: 400 });
  if (!VALID_METHODS.includes(method)) return NextResponse.json({ error: "Phương thức không hợp lệ" }, { status: 400 });

  // Validate promo code (nếu user nhập). Reject sớm nếu mã sai/hết hạn/không đủ điều kiện
  let promoSnapshot: { code: string; bonus: number } | null = null;
  if (promoCode) {
    const r = await validatePromoCode(promoCode, amount, session.user.id);
    if (!r.ok) {
      return NextResponse.json({ error: r.reason }, { status: 400 });
    }
    promoSnapshot = { code: r.code.code, bonus: r.bonus };
  }

  const reference = generateReference();
  const bonus = topupBonus(amount);
  const fullNote = [
    promoSnapshot ? `Mã KM: ${promoSnapshot.code} (+${promoSnapshot.bonus.toLocaleString("vi-VN")}₫)` : null,
    bonus > 0 ? `Bonus mệnh giá: +${bonus.toLocaleString("vi-VN")}₫` : null,
    note,
  ].filter(Boolean).join(" | ") || null;

  const t = await prisma.topupRequest.create({
    data: {
      userId: session.user.id,
      amount,
      method,
      reference,
      note: fullNote,
      promoCode: promoSnapshot?.code ?? null,
      promoBonus: promoSnapshot?.bonus ?? null,
    },
  });

  const qrUrl = buildVietQrUrl({ amount, addInfo: reference });

  return NextResponse.json({
    ok: true,
    id: t.id,
    reference,
    qrUrl,
    bonus,
    promoBonus: promoSnapshot?.bonus ?? 0,
    promoCode: promoSnapshot?.code ?? null,
    bank: BANK_INFO,
  });
}
