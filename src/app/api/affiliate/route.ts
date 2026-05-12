import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureAffiliateCode } from "@/lib/affiliate";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const code = await ensureAffiliateCode(session.user.id);
  return NextResponse.json({ code });
}
