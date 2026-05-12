import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { amount, reason } = await req.json();
  const delta = Number(amount);
  if (!Number.isFinite(delta) || delta === 0) return NextResponse.json({ error: "Số tiền không hợp lệ" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const newBalance = user.balance + delta;
  if (newBalance < 0) return NextResponse.json({ error: "Số dư không thể âm" }, { status: 400 });
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { balance: newBalance } }),
    prisma.transaction.create({
      data: { userId: user.id, type: "ADJUST", amount: delta, balanceAfter: newBalance, description: reason || `Admin điều chỉnh balance` },
    }),
  ]);
  return NextResponse.json({ ok: true, balance: newBalance });
}
