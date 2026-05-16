import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json();
  const data: any = {};
  if (b.displayName) data.displayName = String(b.displayName);
  if (b.provider) data.provider = String(b.provider);
  if (b.slug) data.slug = String(b.slug).trim();
  if (b.category && ["text", "embedding", "image", "video", "tts"].includes(b.category)) data.category = b.category;
  if (b.priceUnit !== undefined) data.priceUnit = String(b.priceUnit || "1M tokens");
  if (b.inputPrice !== undefined) data.inputPrice = Number(b.inputPrice);
  if (b.outputPrice !== undefined) data.outputPrice = Number(b.outputPrice);
  if (b.contextLength !== undefined) data.contextLength = Number(b.contextLength);
  if (b.description !== undefined) data.description = b.description;
  if (b.active !== undefined) data.active = !!b.active;
  if (b.freeDiscount !== undefined) data.freeDiscount = Number(b.freeDiscount) || 0;
  if (b.basicDiscount !== undefined) data.basicDiscount = Number(b.basicDiscount) || 0;
  if (b.advDiscount !== undefined) data.advDiscount = Number(b.advDiscount) || 0;
  if (b.speedTps !== undefined) data.speedTps = Number(b.speedTps) || 0;
  if (b.latencyMs !== undefined) data.latencyMs = Number(b.latencyMs) || 0;
  if (b.uptimeStatus !== undefined && ["good", "warn", "down"].includes(b.uptimeStatus)) data.uptimeStatus = b.uptimeStatus;
  if (b.providerId !== undefined) data.providerId = b.providerId ? String(b.providerId) : null;
  if (b.upstreamSlug !== undefined) data.upstreamSlug = b.upstreamSlug ? String(b.upstreamSlug).trim() : null;
  const m = await prisma.model.update({ where: { id: params.id }, data });
  return NextResponse.json(m);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.model.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
