import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = ["OPENAI", "ANTHROPIC", "GEMINI", "OLLAMA", "OPENAI_COMPATIBLE"];
const ALLOWED_ROUTING = ["ROUND_ROBIN", "FAILOVER", "RANDOM", "LEAST_USED"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json();
  const data: any = {};
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  if (b.description !== undefined) data.description = b.description ? String(b.description) : null;
  if (b.type && ALLOWED_TYPES.includes(b.type)) data.type = b.type;
  if (b.baseUrl !== undefined) {
    data.baseUrl = b.baseUrl && typeof b.baseUrl === "string" ? b.baseUrl.trim().replace(/\/+$/, "") : null;
  }
  if (b.routing && ALLOWED_ROUTING.includes(b.routing)) data.routing = b.routing;
  if (b.enabled !== undefined) data.enabled = !!b.enabled;

  try {
    const p = await prisma.provider.update({ where: { id: params.id }, data });
    return NextResponse.json(p);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi update" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    // Cascade keys; un-link models (set providerId null thay vì xóa Model)
    await prisma.$transaction([
      prisma.model.updateMany({ where: { providerId: params.id }, data: { providerId: null } }),
      prisma.provider.delete({ where: { id: params.id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi xóa" }, { status: 500 });
  }
}
