import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCipherStatus } from "@/lib/key-cipher";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const status = getCipherStatus();
  const raw = process.env.KEY_ENCRYPTION_KEY;
  return NextResponse.json({
    status,
    hasEnv: !!raw,
    envLength: raw?.length ?? 0,
    envPreview: raw ? `${raw.slice(0, 4)}...${raw.slice(-4)}` : null,
    nodeEnv: process.env.NODE_ENV,
  });
}
