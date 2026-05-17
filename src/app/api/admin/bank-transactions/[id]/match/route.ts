// Admin manual match: gán BankTransaction chưa khớp vào một TopupRequest PENDING.
// Input: { query } — có thể là reference (QT...) hoặc email user (sẽ tìm topup PENDING gần nhất).
// Sau khi match, gọi approveTopup với receivedAmount = bankTx.amount.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveTopup } from "@/lib/topup-approve";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { query?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "Thiếu reference hoặc email" }, { status: 400 });
  }

  const bankTx = await prisma.bankTransaction.findUnique({ where: { id: params.id } });
  if (!bankTx) {
    return NextResponse.json({ error: "Giao dịch không tồn tại" }, { status: 404 });
  }
  if (bankTx.matchedTopupId) {
    return NextResponse.json({ error: "Giao dịch đã được khớp trước đó" }, { status: 400 });
  }

  // Tìm topup theo reference hoặc email
  let topup;
  if (/^QT[A-F0-9]{6}$/i.test(query)) {
    topup = await prisma.topupRequest.findUnique({
      where: { reference: query.toUpperCase() },
      include: { user: true },
    });
  } else if (query.includes("@")) {
    topup = await prisma.topupRequest.findFirst({
      where: { user: { email: query }, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { user: true },
    });
  } else {
    return NextResponse.json(
      { error: "Query phải là reference (QT...) hoặc email user" },
      { status: 400 },
    );
  }

  if (!topup) {
    return NextResponse.json({ error: "Không tìm thấy yêu cầu nạp phù hợp" }, { status: 404 });
  }

  // Link bankTx → topup, sau đó approve nếu topup còn PENDING
  if (topup.status === "PENDING") {
    const r = await approveTopup(topup.id, {
      autoApproved: false,
      processedBy: session.user.id,
      sourceLabel: `gán thủ công từ giao dịch ${bankTx.gatewayName}`,
      receivedAmount: bankTx.amount,
    });
    if (!r.ok && !r.alreadyProcessed) {
      return NextResponse.json({ error: "Approve thất bại" }, { status: 500 });
    }
  }

  await prisma.bankTransaction.update({
    where: { id: bankTx.id },
    data: { matchedTopupId: topup.id },
  });

  return NextResponse.json({
    ok: true,
    topupId: topup.id,
    userEmail: topup.user.email,
    amount: bankTx.amount,
  });
}
