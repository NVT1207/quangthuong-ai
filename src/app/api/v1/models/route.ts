import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  // Slug giờ có thể trùng (pool key) → dedupe theo slug khi expose ra OpenAI-compat list endpoint.
  // OpenAI client sẽ confused nếu thấy 2 model id giống hệt nhau.
  const models = await prisma.model.findMany({
    where: { active: true },
    orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
  });
  const seen = new Set<string>();
  const unique = models.filter((m) => {
    if (seen.has(m.slug)) return false;
    seen.add(m.slug);
    return true;
  });
  return NextResponse.json({
    object: "list",
    data: unique.map((m) => ({
      id: m.slug,
      object: "model",
      created: Math.floor(m.createdAt.getTime() / 1000),
      owned_by: m.provider,
    })),
  });
}
