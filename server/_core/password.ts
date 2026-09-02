import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;
const SCRYPT_SALT = process.env.PASSWORD_SCRYPT_SALT || "aft-local-auth-v1";

function deriveKey(password: string, salt: string): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = deriveKey(password, `${SCRYPT_SALT}::${salt}`);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.startsWith("scrypt$")) return false;
  const [, salt, hex] = stored.split("$");
  if (!salt || !hex) return false;
  try {
    const expected = Buffer.from(hex, "hex");
    const derived = deriveKey(password, `${SCRYPT_SALT}::${salt}`);
    if (expected.length !== derived.length) return false;
    return timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}
