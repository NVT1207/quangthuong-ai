import { prisma } from "../src/lib/prisma";
import { syncUserTier } from "../src/lib/tier";

(async () => {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) await syncUserTier(u.id);
  console.log(`Synced tier for ${users.length} users`);
  await prisma.$disconnect();
})();
