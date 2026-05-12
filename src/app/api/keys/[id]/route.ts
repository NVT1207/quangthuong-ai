import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function findOwnedKey(userId: string, id: string) {
  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key || key.userId !== userId) return null;
  return key;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = await findOwnedKey(session.user.id, params.id);
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Thiếu tên" }, { status: 400 });
  }
  const updated = await prisma.apiKey.update({
    where: { id: params.id },
    data: { name: body.name.trim().slice(0, 80) },
  });
  return NextResponse.json({ ok: true, name: updated.name });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = await findOwnedKey(session.user.id, params.id);
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.apiKey.update({ where: { id: params.id }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
