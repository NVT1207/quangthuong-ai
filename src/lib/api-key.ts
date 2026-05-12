import crypto from "crypto";
import bcrypt from "bcryptjs";

export function generateApiKey() {
  const randomPart = crypto.randomBytes(24).toString("base64url");
  const full = `sk-bee-${randomPart}`;
  const prefix = full.slice(0, 11);
  const suffix = full.slice(-4);
  return { full, prefix, suffix };
}

export async function hashKey(key: string) {
  return bcrypt.hash(key, 10);
}

export async function verifyKey(key: string, hash: string) {
  return bcrypt.compare(key, hash);
}
