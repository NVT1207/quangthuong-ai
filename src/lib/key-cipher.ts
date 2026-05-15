// AES-256-GCM cipher cho full API key.
// Key encryption key (KEK) đọc từ env KEY_ENCRYPTION_KEY (32 bytes base64).
// Format ciphertext: base64(iv | tag | ciphertext) — iv 12 bytes, tag 16 bytes.

import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

export type CipherStatus =
  | { ok: true }
  | { ok: false; reason: "missing" }
  | { ok: false; reason: "invalid_length"; got: number }
  | { ok: false; reason: "invalid_base64" };

export function getCipherStatus(): CipherStatus {
  const raw = process.env.KEY_ENCRYPTION_KEY;
  if (!raw || !raw.trim()) return { ok: false, reason: "missing" };
  // Vercel UI thi thoảng dán kèm whitespace/newline → trim trước khi decode.
  const trimmed = raw.trim();
  let buf: Buffer;
  try {
    buf = Buffer.from(trimmed, "base64");
  } catch {
    return { ok: false, reason: "invalid_base64" };
  }
  // Buffer.from(base64) silently nuốt ký tự lạ. Check round-trip để bắt format sai.
  if (buf.toString("base64").replace(/=+$/, "") !== trimmed.replace(/=+$/, "")) {
    return { ok: false, reason: "invalid_base64" };
  }
  if (buf.length !== 32) return { ok: false, reason: "invalid_length", got: buf.length };
  return { ok: true };
}

function getKey(): Buffer {
  const status = getCipherStatus();
  if (!status.ok) {
    if (status.reason === "missing") {
      throw new Error("KEY_ENCRYPTION_KEY chưa được set trong env.");
    }
    if (status.reason === "invalid_base64") {
      throw new Error("KEY_ENCRYPTION_KEY không phải base64 hợp lệ. Sinh lại bằng: openssl rand -base64 32");
    }
    throw new Error(`KEY_ENCRYPTION_KEY phải là 32 bytes (256-bit) base64, hiện ${status.got} bytes. Sinh lại bằng: openssl rand -base64 32`);
  }
  return Buffer.from((process.env.KEY_ENCRYPTION_KEY as string).trim(), "base64");
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
  return getCipherStatus().ok;
}
