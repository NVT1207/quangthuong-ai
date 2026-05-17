// Sepay webhook receiver — auto-approve topup khi nhận tiền vào tài khoản ngân hàng.
//
// Setup tại sepay.vn:
//   1. Vào "Tích hợp webhook"
//   2. URL: https://<domain>/api/webhooks/sepay
//   3. Cách chứng thực: "Apikey" → dán key vào env SEPAY_WEBHOOK_KEY
//   4. Save → test
//
// Payload Sepay (POST JSON):
// {
//   id: number,                  // gateway tx id (idempotency)
//   gateway: string,             // tên ngân hàng "Vietinbank"
//   transactionDate: string,     // "2023-03-25 14:02:37"
//   accountNumber: string,
//   content: string,             // nội dung chuyển khoản (chứa QT-xxxxx)
//   transferType: "in" | "out",
//   transferAmount: number,      // số tiền (VND)
//   ...
// }

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approveTopup, parseReferenceFromContent } from "@/lib/topup-approve";

export const dynamic = "force-dynamic";

function checkAuth(req: Request): boolean {
  const expected = process.env.SEPAY_WEBHOOK_KEY;
  if (!expected) return false;
  const auth = req.headers.get("authorization") || "";
  // Sepay gửi "Apikey <key>" (case-sensitive theo doc nhưng tolerant)
  const m = auth.match(/^Apikey\s+(.+)$/i);
  if (!m) return false;
  return m[1].trim() === expected;
}

export async function POST(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const gatewayTxId = String(body?.id ?? "").trim();
  const transferType = String(body?.transferType ?? "").toLowerCase();
  const transferAmount = Number(body?.transferAmount ?? 0);
  const content = String(body?.content ?? "");
  const gateway = String(body?.gateway ?? "Unknown");
  const accountNumber = body?.accountNumber ? String(body.accountNumber) : null;
  const transactionDateStr = String(body?.transactionDate ?? "");

  if (!gatewayTxId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Chỉ xử lý tiền VÀO. Tiền ra (out) chỉ log, không action.
  if (transferType !== "in") {
    return NextResponse.json({ ok: true, skipped: "not an incoming transfer" });
  }

  // Idempotency: nếu đã xử lý id này rồi → skip
  const existing = await prisma.bankTransaction.findUnique({
    where: { gatewayTxId },
    select: { id: true, matchedTopupId: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, duplicated: true, bankTxId: existing.id });
  }

  const reference = parseReferenceFromContent(content);
  const txDate = transactionDateStr ? new Date(transactionDateStr.replace(" ", "T")) : new Date();

  // Tìm topup match theo reference (chỉ approve nếu vẫn PENDING)
  let matchedTopupId: string | null = null;
  let approveResult: { credited: number; bonus: number; userId: string } | null = null;

  if (reference) {
    const topup = await prisma.topupRequest.findUnique({
      where: { reference },
      select: { id: true, status: true, userId: true },
    });
    if (topup && topup.status === "PENDING") {
      try {
        const r = await approveTopup(topup.id, {
          autoApproved: true,
          processedBy: null,
          sourceLabel: `Sepay webhook (${gateway})`,
          receivedAmount: transferAmount,
        });
        if (r.ok) {
          matchedTopupId = topup.id;
          approveResult = { credited: r.amountCredited, bonus: r.bonus, userId: r.userId };
        }
      } catch (e) {
        // Approve fail → vẫn ghi bankTransaction unmatched để admin xem
        console.error("[sepay] approveTopup failed", e);
      }
    } else if (topup && topup.status === "APPROVED") {
      // Topup đã approved trước đó (manual hoặc lần webhook trước) → vẫn link để truy vết
      matchedTopupId = topup.id;
    }
  }

  // Ghi log BankTransaction (matched hoặc unmatched đều log)
  const bankTx = await prisma.bankTransaction.create({
    data: {
      gatewayTxId,
      gatewayName: gateway,
      accountNumber,
      amount: transferAmount,
      content,
      transferType,
      reference,
      matchedTopupId,
      transactionDate: isNaN(txDate.getTime()) ? new Date() : txDate,
      rawPayload: body,
    },
  });

  return NextResponse.json({
    ok: true,
    bankTxId: bankTx.id,
    matched: !!matchedTopupId,
    reference,
    approved: !!approveResult,
    credited: approveResult?.credited ?? 0,
  });
}

// Cho phép Sepay test ping GET
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Sepay webhook endpoint. POST JSON với header Authorization: Apikey <SEPAY_WEBHOOK_KEY>.",
    configured: !!process.env.SEPAY_WEBHOOK_KEY,
  });
}
