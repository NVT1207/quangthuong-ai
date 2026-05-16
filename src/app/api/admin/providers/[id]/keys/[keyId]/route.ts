import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; keyId: string } }
) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json();
  const data: any = {};
  if (b.enabled !== undefined) data.enabled = !!b.enabled;
  if (b.label !== undefined) data.label = b.label ? String(b.label) : null;
  if (b.resetErrors === true) {
    data.errorCount = 0;
    data.lastErrorAt = null;
  }
  try {
    const k = await prisma.providerKey.update({
      where: { id: params.keyId },
      data,
      select: {
        id: true, prefix: true, label: true, enabled: true,
        lastUsedAt: true, lastErrorAt: true, errorCount: true,
        totalRequests: true, totalErrors: true, createdAt: true,
      },
    });
    return NextResponse.json(k);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi update key" }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: { id: string; keyId: string } }
) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await prisma.providerKey.delete({ where: { id: params.keyId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi xóa key" }, { status: 500 });
  }
}
