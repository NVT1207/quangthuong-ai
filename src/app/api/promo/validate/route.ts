// Validate mã ưu đãi real-time cho topup form. Trả về { ok, bonus, reason }.
// Yêu cầu user đã đăng nhập (vì check firstUseOnly dựa trên userId).

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { validatePromoCode } from "@/lib/promo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, reason: "Vui lòng đăng nhập" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "");
  const amount = Number(body.amount ?? 0);

  try {
    const r = await validatePromoCode(code, amount, session.user.id);
    if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason });
    return NextResponse.json({
      ok: true,
      code: r.code.code,
      bonus: r.bonus,
      description: r.code.description ?? null,
    });
  } catch (e: any) {
    // P2021 = table không tồn tại (chưa chạy prisma db push)
    if (e?.code === "P2021") {
      return NextResponse.json(
        { ok: false, reason: "Hệ thống mã ưu đãi chưa được khởi tạo. Vui lòng liên hệ admin." },
        { status: 503 },
      );
    }
    console.error("[promo/validate] error:", e);
    return NextResponse.json({ ok: false, reason: "Lỗi server khi kiểm tra mã" }, { status: 500 });
  }
}
