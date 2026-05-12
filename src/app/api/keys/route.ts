import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey, hashKey } from "@/lib/api-key";
import { formatDateTime } from "@/lib/format";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(keys);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = await req.json();
  if (!name || typeof name !== "string") return NextResponse.json({ error: "Thiếu tên" }, { status: 400 });

  const { full, prefix, suffix } = generateApiKey();
  const keyHash = await hashKey(full);
  const key = await prisma.apiKey.create({
    data: { userId: session.user.id, name: name.trim().slice(0, 80), keyHash, prefix, suffix },
  });
  return NextResponse.json({
    fullKey: full,
    key: {
      id: key.id, name: key.name, prefix: key.prefix, suffix: key.suffix,
      createdAt: formatDateTime(key.createdAt), lastUsedAt: null,
    },
  });
}
