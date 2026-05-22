import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/keys/[id]/available-models?q=&category= — danh sách model admin active mà key CHƯA subscribe.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = await prisma.apiKey.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });
  if (!key || key.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";

  // Slug giờ có thể trùng (pool key). Subscribe 1 row = subscribe cả slug ở phía gateway,
  // nên available-models phải filter theo slug, không phải modelId.
  const subscribed = await prisma.apiKeyModel.findMany({
    where: { apiKeyId: params.id },
    select: { model: { select: { slug: true } } },
  });
  const subscribedSlugs = Array.from(new Set(subscribed.map((s) => s.model.slug)));

  const where: any = { active: true, slug: { notIn: subscribedSlugs } };
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { provider: { contains: q, mode: "insensitive" } },
    ];
  }

  // Dedupe theo slug — chỉ hiện 1 row đại diện cho mỗi slug pool.
  const rawItems = await prisma.model.findMany({
    where,
    select: {
      id: true, slug: true, displayName: true, provider: true, category: true,
      inputPrice: true, outputPrice: true, priceUnit: true, contextLength: true,
    },
    orderBy: [{ provider: "asc" }, { displayName: "asc" }, { createdAt: "asc" }],
    take: 500,
  });
  const seenSlug = new Set<string>();
  const items = rawItems.filter((m) => {
    if (seenSlug.has(m.slug)) return false;
    seenSlug.add(m.slug);
    return true;
  }).slice(0, 200);

  return NextResponse.json({ items });
}
