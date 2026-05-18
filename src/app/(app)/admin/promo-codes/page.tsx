import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PromoCodesClient } from "./promo-codes-client";

export const dynamic = "force-dynamic";

export default async function AdminPromoCodesPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mã ưu đãi nạp tiền</h1>
        <p className="text-sm text-ink-200/60">
          Tạo mã khuyến mãi (PERCENT hoặc FIXED). Khi user nạp + nhập mã + được approve, bonus tự cộng vào balance.
        </p>
      </div>
      <PromoCodesClient
        initial={codes.map((c) => ({
          id: c.id,
          code: c.code,
          description: c.description,
          bonusType: c.bonusType,
          bonusPercent: c.bonusPercent,
          bonusAmount: c.bonusAmount,
          minAmount: c.minAmount,
          maxBonus: c.maxBonus,
          firstUseOnly: c.firstUseOnly,
          enabled: c.enabled,
          startsAt: c.startsAt?.toISOString() ?? null,
          expiresAt: c.expiresAt?.toISOString() ?? null,
          maxUses: c.maxUses,
          usedCount: c.usedCount,
          redemptionCount: c._count.redemptions,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
