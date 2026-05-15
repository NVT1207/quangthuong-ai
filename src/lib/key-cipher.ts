// AES-256-GCM cipher cho full API key.
// Key encryption key (KEK) đọc từ env KEY_ENCRYPTION_KEY (32 bytes base64).
// Format ciphertext: base64(iv | tag | ciphertext) — iv 12 bytes, tag 16 bytes.

import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.KEY_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("KEY_ENCRYPTION_KEY chưa cấu hình. Thêm 32 bytes base64 vào env.");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(`KEY_ENCRYPTION_KEY phải là 32 bytes (256-bit) base64, hiện ${buf.length} bytes.`);
  }
  return buf;
}

export function encryptKey(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptKey(ciphertextB64: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertextB64, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("Ciphertext không hợp lệ.");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

export function isCipherConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}
