import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PLAN_PRICES,
  PERIOD_DAYS,
  PERIOD_LABEL,
  TIER_LABEL,
  TIER_RANK,
  syncUserTier,
  resolveTier,
  topup30dTotal,
  type PaidPlan,
  type Period,
  type Tier,
} from "@/lib/tier";

const PLANS: PaidPlan[] = ["BASIC", "ADV"];
const PERIODS: Period[] = ["MONTH", "HALF_YEAR", "YEAR"];

// GET /api/subscriptions — trạng thái gói hiện tại của user (cho tab Subscription trong modal key detail).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [user, r, topup30d] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { balance: true } }),
    resolveTier(session.user.id),
    topup30dTotal(session.user.id),
  ]);
  return NextResponse.json({
    balance: user?.balance ?? 0,
    tier: r.tier,
    tierSource: r.source,
    autoTier: r.auto,
    tierExpiresAt: r.paidExpires,
    topup30d,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const plan = body.plan as PaidPlan;
  const period = body.period as Period;
  if (!PLANS.includes(plan)) {
    return NextResponse.json({ error: "plan không hợp lệ" }, { status: 400 });
  }
  if (!PERIODS.includes(period)) {
    return NextResponse.json({ error: "period không hợp lệ" }, { status: 400 });
  }

  const amount = PLAN_PRICES[plan][period];
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.balance < amount) {
    return NextResponse.json(
      {
        error: `Số dư không đủ — cần ${amount.toLocaleString(
          "vi-VN"
        )}₫ để mua gói. Hãy nạp thêm trước.`,
      },
      { status: 402 }
    );
  }

  const now = new Date();
  const existing = await prisma.subscription.findFirst({
    where: { userId: user.id, status: "ACTIVE", expiresAt: { gt: now } },
    orderBy: { expiresAt: "desc" },
  });

  const newPlanRank = TIER_RANK[plan as Tier];

  const ops: any[] = [];
  let newExpiresAt: Date;
  let extending = false;

  if (existing) {
    const existingRank = TIER_RANK[existing.plan as Tier];

    if (existing.plan === plan) {
      // Gia hạn — cộng dồn từ ngày hết hạn hiện tại
      newExpiresAt = new Date(
        existing.expiresAt.getTime() + PERIOD_DAYS[period] * 86_400_000
      );
      extending = true;
      ops.push(
        prisma.subscription.update({
          where: { id: existing.id },
          data: { expiresAt: newExpiresAt, amount: existing.amount + amount },
        })
      );
    } else if (newPlanRank > existingRank) {
      // Upgrade — cancel sub cũ, tạo sub mới từ now
      newExpiresAt = new Date(now.getTime() + PERIOD_DAYS[period] * 86_400_000);
      ops.push(
        prisma.subscription.update({
          where: { id: existing.id },
          data: { status: "CANCELLED" },
        }),
        prisma.subscription.create({
          data: {
            userId: user.id,
            plan,
            period,
            amount,
            startedAt: now,
            expiresAt: newExpiresAt,
            status: "ACTIVE",
          },
        })
      );
    } else {
      return NextResponse.json(
        { error: "Bạn đang dùng gói cao hơn — không thể downgrade khi còn hạn" },
        { status: 400 }
      );
    }
  } else {
    // Lần đầu mua
    newExpiresAt = new Date(now.getTime() + PERIOD_DAYS[period] * 86_400_000);
    ops.push(
      prisma.subscription.create({
        data: {
          userId: user.id,
          plan,
          period,
          amount,
          startedAt: now,
          expiresAt: newExpiresAt,
          status: "ACTIVE",
        },
      })
    );
  }

  const newBalance = user.balance - amount;
  ops.unshift(
    prisma.user.update({
      where: { id: user.id },
      data: { balance: newBalance },
    }),
    prisma.transaction.create({
      data: {
        userId: user.id,
        type: "SUBSCRIPTION",
        amount: -amount,
        balanceAfter: newBalance,
        description: `${extending ? "Gia hạn" : "Mua"} gói ${
          TIER_LABEL[plan as Tier]
        } (${PERIOD_LABEL[period]})`,
      },
    })
  );

  await prisma.$transaction(ops);
  const r = await syncUserTier(user.id);

  return NextResponse.json({
    ok: true,
    tier: r.tier,
    source: r.source,
    expiresAt: r.paidExpires,
    amount,
  });
}
