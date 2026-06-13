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

async function ensureOwnedKey(userId: string, keyId: string) {
  const k = await prisma.apiKey.findUnique({ where: { id: keyId }, select: { id: true, userId: true } });
  if (!k || k.userId !== userId) return null;
  return k;
}

// Map slug → { displayName, provider } cho các model key này đã subscribe.
async function subscribedModelMap(apiKeyId: string) {
  const subs = await prisma.apiKeyModel.findMany({
    where: { apiKeyId, enabled: true },
    include: { model: { select: { slug: true, displayName: true, provider: true, active: true } } },
  });
  const map = new Map<string, { displayName: string; provider: string }>();
  for (const s of subs) {
    if (!s.model.active) continue;
    if (!map.has(s.model.slug)) map.set(s.model.slug, { displayName: s.model.displayName, provider: s.model.provider });
  }
  return map;
}

// GET /api/keys/[id]/combos — list combo của key
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = await ensureOwnedKey(session.user.id, params.id);
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [combos, modelMap] = await Promise.all([
    prisma.keyCombo.findMany({
      where: { apiKeyId: params.id },
      include: { members: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    subscribedModelMap(params.id),
  ]);

  const items = combos.map((c) => ({
    id: c.id,
    name: c.name,
    strategy: c.strategy,
    enabled: c.enabled,
    createdAt: c.createdAt.toISOString(),
    members: c.members.map((m) => ({
      order: m.order,
      slug: m.modelSlug,
      displayName: modelMap.get(m.modelSlug)?.displayName ?? m.modelSlug,
      provider: modelMap.get(m.modelSlug)?.provider ?? "",
      missing: !modelMap.has(m.modelSlug), // member không còn được subscribe
    })),
  }));

  return NextResponse.json({ items });
}

// POST /api/keys/[id]/combos — { name, strategy, memberSlugs[] }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = await ensureOwnedKey(session.user.id, params.id);
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = await req.json().catch(() => null);
  const name = typeof b?.name === "string" ? b.name.trim() : "";
  const strategy = normalizeStrategy(b?.strategy);
  const rawSlugs: string[] = Array.isArray(b?.memberSlugs) ? b.memberSlugs.filter((x: any) => typeof x === "string") : [];
  // Dedupe giữ thứ tự
  const memberSlugs = [...new Set(rawSlugs.map((s) => s.trim()).filter(Boolean))];

  if (!isValidComboName(name)) {
    return NextResponse.json({ error: "Tên combo không hợp lệ (1-64 ký tự, chỉ chữ/số/./_/-)" }, { status: 400 });
  }
  if (memberSlugs.length === 0) {
    return NextResponse.json({ error: "Combo phải có ít nhất 1 thành viên" }, { status: 400 });
  }
  if (memberSlugs.length > MAX_COMBO_MEMBERS) {
    return NextResponse.json({ error: `Tối đa ${MAX_COMBO_MEMBERS} thành viên/combo` }, { status: 400 });
  }

  // Member phải là model key đã subscribe (active)
  const modelMap = await subscribedModelMap(params.id);
  const invalid = memberSlugs.filter((s) => !modelMap.has(s));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Model chưa được thêm vào key này: ${invalid.join(", ")}` }, { status: 400 });
  }

  try {
    const combo = await prisma.keyCombo.create({
      data: {
        apiKeyId: params.id,
        name,
        strategy,
        members: { create: memberSlugs.map((slug, i) => ({ order: i, modelSlug: slug })) },
      },
    });
    return NextResponse.json({ ok: true, id: combo.id });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: `Đã có combo tên "${name}" cho key này` }, { status: 409 });
    }
    return NextResponse.json({ error: "Không tạo được combo" }, { status: 500 });
  }
}
