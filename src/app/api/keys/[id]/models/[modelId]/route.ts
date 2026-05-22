import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Slug giờ có thể trùng (pool key) → toggle/delete phải áp dụng cho TẤT CẢ row trùng slug,
// nếu không user sẽ thấy state lệch (gateway check theo slug nhưng UI hiện 1 row).
async function ensureSubOwned(userId: string, keyId: string, modelId: string) {
  const sub = await prisma.apiKeyModel.findUnique({
    where: { apiKeyId_modelId: { apiKeyId: keyId, modelId } },
    include: {
      apiKey: { select: { userId: true } },
      model: { select: { slug: true } },
    },
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

  // Toggle TẤT CẢ apiKeyModel có model.slug = slug picked (gồm cả modelId hiện tại + các row pool khác).
  await prisma.apiKeyModel.updateMany({
    where: { apiKeyId: params.id, model: { slug: sub.model.slug } },
    data: { enabled: b.enabled },
  });
  return NextResponse.json({ ok: true });
}

// DELETE /api/keys/[id]/models/[modelId] — bỏ subscribe toàn bộ slug pool
export async function DELETE(_: Request, { params }: { params: { id: string; modelId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sub = await ensureSubOwned(session.user.id, params.id, params.modelId);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.apiKeyModel.deleteMany({
    where: { apiKeyId: params.id, model: { slug: sub.model.slug } },
  });
  return NextResponse.json({ ok: true });
}
