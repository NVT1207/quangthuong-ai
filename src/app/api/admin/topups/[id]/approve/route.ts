import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { approveTopup } from "@/lib/topup-approve";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const r = await approveTopup(params.id, {
      autoApproved: false,
      processedBy: session.user.id,
      sourceLabel: "duyệt thủ công",
    });
    if (r.alreadyProcessed) {
      return NextResponse.json({ error: "Yêu cầu đã xử lý" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, amountCredited: r.amountCredited, bonus: r.bonus, newBalance: r.newBalance });
  } catch (e: any) {
    if (e?.message === "Topup không tồn tại") {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    return NextResponse.json({ error: e?.message || "Lỗi server" }, { status: 500 });
  }
}
