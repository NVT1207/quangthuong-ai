import { prisma } from "./prisma";

export const AFFILIATE_RATE = 0.10; // 10% trọn đời trên mỗi lần nạp của người được giới thiệu

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len = 8) {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export async function ensureAffiliateCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { affiliateCode: true } });
  if (user?.affiliateCode) return user.affiliateCode;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const exists = await prisma.user.findUnique({ where: { affiliateCode: code }, select: { id: true } });
    if (exists) continue;
    try {
      await prisma.user.update({ where: { id: userId }, data: { affiliateCode: code } });
      return code;
    } catch {
      // race — retry
    }
  }
  throw new Error("Không thể tạo mã affiliate");
}

export async function findReferrerByCode(code: string | null | undefined) {
  if (!code) return null;
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  return prisma.user.findUnique({ where: { affiliateCode: clean }, select: { id: true, name: true, email: true } });
}
