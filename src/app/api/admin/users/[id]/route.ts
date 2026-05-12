import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const data: any = {};
  if (body.role && ["USER", "ADMIN"].includes(body.role)) data.role = body.role;
  if (body.status && ["ACTIVE", "BANNED"].includes(body.status)) data.status = body.status;
  if (typeof body.name === "string") data.name = body.name.slice(0, 80);
  const u = await prisma.user.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true, user: u });
}
