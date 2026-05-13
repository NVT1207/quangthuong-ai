import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { findReferrerByCode } from "@/lib/affiliate";

const schema = z.object({
  name: z.string().max(80).optional().nullable(),
  email: z.string().email(),
  password: z.string().min(6).max(120),
  ref: z.string().max(32).optional().nullable(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const { name, email, password, ref } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) return NextResponse.json({ error: "Email đã được dùng" }, { status: 409 });
  const referrer = await findReferrerByCode(ref);
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name: name || null,
      passwordHash,
      balance: 0,
      referredById: referrer?.id ?? null,
    },
  });
  return NextResponse.json({ ok: true, id: user.id });
}
