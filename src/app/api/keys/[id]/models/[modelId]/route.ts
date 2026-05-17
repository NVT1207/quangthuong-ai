import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureSubOwned(userId: string, keyId: string, modelId: string) {
  const sub = await prisma.apiKeyModel.findUnique({
    where: { apiKeyId_modelId: { apiKeyId: keyId, modelId } },
    include: { apiKey: { select: { userId: true } } },
  });
  if (!sub || sub.apiKey.userId !== userId) return null;
  return sub;
}

// PATCH /api/keys/[id]/models/[modelId] — { enabled: boolean } toggle bật/tắt subscribe
export async function PATCH(req: Request, { params }: { params: { id: string; modelId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sub = await ensureSubOwned(session.user.id, params.id, params.modelId);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = await req.json().catch(() => null);
  if (typeof b?.enabled !== "boolean") return NextResponse.json({ error: "Thiếu enabled" }, { status: 400 });

  await prisma.apiKeyModel.update({
    where: { apiKeyId_modelId: { apiKeyId: params.id, modelId: params.modelId } },
    data: { enabled: b.enabled },
  });
  return NextResponse.json({ ok: true });
}

// DELETE /api/keys/[id]/models/[modelId] — bỏ subscribe hẳn
export async function DELETE(_: Request, { params }: { params: { id: string; modelId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sub = await ensureSubOwned(session.user.id, params.id, params.modelId);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.apiKeyModel.delete({
    where: { apiKeyId_modelId: { apiKeyId: params.id, modelId: params.modelId } },
  });
  return NextResponse.json({ ok: true });
}
