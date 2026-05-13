import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncUserTier, topup30dTotal } from "@/lib/tier";
import { UpgradeClient } from "./upgrade-client";

export const dynamic = "force-dynamic";

export default async function NangCapPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const r = await syncUserTier(session.user.id);
  const [user, topup30d] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, balance: true, tier: true, tierSource: true, tierExpiresAt: true },
    }),
    topup30dTotal(session.user.id),
  ]);
  if (!user) redirect("/login");

  return (
    <UpgradeClient
      balance={user.balance}
      tier={user.tier}
      tierSource={user.tierSource}
      tierExpiresAt={user.tierExpiresAt ? user.tierExpiresAt.toISOString() : null}
      autoTier={r.auto}
      topup30d={topup30d}
    />
  );
}
