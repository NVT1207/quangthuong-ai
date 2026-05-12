import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { currentPw, newPw } = await req.json();
  if (!newPw || newPw.length < 6) return NextResponse.json({ error: "Mật khẩu mới quá ngắn" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ok = await bcrypt.compare(currentPw, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPw, 10) } });
  return NextResponse.json({ ok: true });
}
