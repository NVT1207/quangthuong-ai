import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = await prisma.apiKey.findUnique({ where: { id: params.id } });
  if (!key || key.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Thiếu enabled" }, { status: 400 });
  }
  const updated = await prisma.apiKey.update({
    where: { id: params.id },
    data: { enabled: body.enabled },
  });
  return NextResponse.json({ ok: true, enabled: updated.enabled });
}
