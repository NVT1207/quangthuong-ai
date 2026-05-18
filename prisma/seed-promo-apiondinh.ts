// Seed mã APIONDINH: +10% bonus, min 3.000.000₫, lần đầu dùng, hết hạn 23:59:59 25/5/2026 (giờ VN +07).
//
// Chạy: npx tsx prisma/seed-promo-apiondinh.ts
//
// Idempotent — upsert theo code. Chạy lại sẽ overwrite các field (giữ usedCount).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 25/5/2026 23:59:59 GMT+07 = 16:59:59 UTC
const EXPIRES_AT = new Date("2026-05-25T23:59:59+07:00");

async function main() {
  const code = "APIONDINH";
  const data = {
    code,
    description: "Khuyến mãi mở khóa API Quang Thưởng AI — +10% bonus cho lần đầu nạp tối thiểu 3.000.000₫",
    bonusType: "PERCENT",
    bonusPercent: 10,
    bonusAmount: 0,
    minAmount: 3_000_000,
    maxBonus: null,
    firstUseOnly: true,
    enabled: true,
    startsAt: null,
    expiresAt: EXPIRES_AT,
    maxUses: null,
  };

  const existing = await prisma.promoCode.findUnique({ where: { code } });
  if (existing) {
    await prisma.promoCode.update({ where: { code }, data });
    console.log(`✅ Updated mã ${code}`);
  } else {
    await prisma.promoCode.create({ data });
    console.log(`✅ Created mã ${code}`);
  }

  console.log(`   • Loại: PERCENT 10%`);
  console.log(`   • Min nạp: 3.000.000₫`);
  console.log(`   • Lần đầu dùng: YES`);
  console.log(`   • Hết hạn: ${EXPIRES_AT.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (giờ VN)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
