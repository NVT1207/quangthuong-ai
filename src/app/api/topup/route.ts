import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { BANK_INFO, buildVietQrUrl, topupBonus } from "@/lib/topup";

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
  const promoCode = body.promoCode ? String(body.promoCode).trim().toUpperCase().slice(0, 24) : null;
  const note = body.note ? String(body.note).slice(0, 300) : null;

  if (!amount || amount < 20000) return NextResponse.json({ error: "Số tiền tối thiểu 20.000₫" }, { status: 400 });
  if (amount > 500_000_000) return NextResponse.json({ error: "Số tiền tối đa 500.000.000₫" }, { status: 400 });
  if (!VALID_METHODS.includes(method)) return NextResponse.json({ error: "Phương thức không hợp lệ" }, { status: 400 });

  const reference = generateReference();
  const bonus = topupBonus(amount);
  const fullNote = [
    promoCode ? `Mã KM: ${promoCode}` : null,
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
    },
  });

  const qrUrl = buildVietQrUrl({ amount, addInfo: reference });

  return NextResponse.json({
    ok: true,
    id: t.id,
    reference,
    qrUrl,
    bonus,
    bank: BANK_INFO,
  });
}
