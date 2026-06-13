import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isValidComboName,
  normalizeStrategy,
  MAX_COMBO_MEMBERS,
} from "@/lib/key-combo";

export const dynamic = "force-dynamic";

async function ensureOwnedCombo(userId: string, keyId: string, comboId: string) {
  const combo = await prisma.keyCombo.findUnique({
    where: { id: comboId },
    include: { apiKey: { select: { id: true, userId: true } } },
  });
  if (!combo || combo.apiKeyId !== keyId || combo.apiKey.userId !== userId) return null;
  return combo;
}

async function subscribedSlugs(apiKeyId: string): Promise<Set<string>> {
  const subs = await prisma.apiKeyModel.findMany({
    where: { apiKeyId, enabled: true },
    include: { model: { select: { slug: true, active: true } } },
  });
  const set = new Set<string>();
  for (const s of subs) if (s.model.active) set.add(s.model.slug);
  return set;
}

// PATCH /api/keys/[id]/combos/[comboId] — { name?, strategy?, enabled?, memberSlugs? }
export async function PATCH(req: Request, { params }: { params: { id: string; comboId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const combo = await ensureOwnedCombo(session.user.id, params.id, params.comboId);
  if (!combo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = await req.json().catch(() => null);
  const data: any = {};

  if (typeof b?.name === "string") {
    const name = b.name.trim();
    if (!isValidComboName(name)) {
      return NextResponse.json({ error: "Tên combo không hợp lệ (1-64 ký tự, chỉ chữ/số/./_/-)" }, { status: 400 });
    }
    data.name = name;
  }
  if (b?.strategy !== undefined) data.strategy = normalizeStrategy(b.strategy);
  if (typeof b?.enabled === "boolean") data.enabled = b.enabled;

  let newMemberSlugs: string[] | null = null;
  if (Array.isArray(b?.memberSlugs)) {
    const raw = b.memberSlugs.filter((x: any) => typeof x === "string").map((s: string) => s.trim()).filter(Boolean);
    newMemberSlugs = [...new Set<string>(raw)];
    if (newMemberSlugs.length === 0) {
      return NextResponse.json({ error: "Combo phải có ít nhất 1 thành viên" }, { status: 400 });
    }
    if (newMemberSlugs.length > MAX_COMBO_MEMBERS) {
      return NextResponse.json({ error: `Tối đa ${MAX_COMBO_MEMBERS} thành viên/combo` }, { status: 400 });
    }
    const subSet = await subscribedSlugs(params.id);
    const invalid = newMemberSlugs.filter((s) => !subSet.has(s));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Model chưa được thêm vào key này: ${invalid.join(", ")}` }, { status: 400 });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.keyCombo.update({ where: { id: params.comboId }, data });
      }
      if (newMemberSlugs) {
        await tx.keyComboMember.deleteMany({ where: { comboId: params.comboId } });
        await tx.keyComboMember.createMany({
          data: newMemberSlugs.map((slug, i) => ({ comboId: params.comboId, order: i, modelSlug: slug })),
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: `Đã có combo trùng tên cho key này` }, { status: 409 });
    }
    return NextResponse.json({ error: "Không cập nhật được combo" }, { status: 500 });
  }
}

// DELETE /api/keys/[id]/combos/[comboId]
export async function DELETE(_: Request, { params }: { params: { id: string; comboId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const combo = await ensureOwnedCombo(session.user.id, params.id, params.comboId);
  if (!combo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.keyCombo.delete({ where: { id: params.comboId } });
  return NextResponse.json({ ok: true });
}
