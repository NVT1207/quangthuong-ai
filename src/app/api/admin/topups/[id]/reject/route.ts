import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const t = await prisma.topupRequest.findUnique({ where: { id: params.id } });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (t.status !== "PENDING") return NextResponse.json({ error: "Yêu cầu đã xử lý" }, { status: 400 });
  await prisma.topupRequest.update({
    where: { id: t.id },
    data: { status: "REJECTED", processedBy: session.user.id, processedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
