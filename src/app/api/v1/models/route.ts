import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const models = await prisma.model.findMany({ where: { active: true }, orderBy: { displayName: "asc" } });
  return NextResponse.json({
    object: "list",
    data: models.map((m) => ({
      id: m.slug,
      object: "model",
      created: Math.floor(m.createdAt.getTime() / 1000),
      owned_by: m.provider,
    })),
  });
}
