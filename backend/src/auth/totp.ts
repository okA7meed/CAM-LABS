import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Minimal RFC 4648 base32 (no padding) + RFC 6238 TOTP implementation.
 *
 * Deliberately dependency-free: the Account Settings 2FA flow needs secret
 * generation and code verification only, and pulling a full OTP library for
 * that would add unnecessary supply-chain surface to the auth path.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const generateTotpSecret = (bytes = 20): string => {
  const raw = randomBytes(bytes);
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of raw) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
};

const base32Decode = (input: string): Buffer => {
  const clean = input.trim().replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 secret.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

const hotp = (secret: Buffer, counter: bigint): string => {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', secret).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
};

export const TOTP_STEP_SECONDS = 30;

/** Current TOTP code (used by tests, never exposed over the API). */
export const currentTotpCode = (secret: string, atMs = Date.now()): string =>
  hotp(base32Decode(secret), BigInt(Math.floor(atMs / 1000 / TOTP_STEP_SECONDS)));

/**
 * Verifies a 6-digit code against the secret, accepting clock drift of
 * ±1 step. Constant-time comparison per candidate.
 */
export const verifyTotpCode = (secret: string, code: string, atMs = Date.now()): boolean => {
  if (!/^[0-9]{6}$/.test(code)) return false;
  let key: Buffer;
  try {
    key = base32Decode(secret);
  } catch {
    return false;
  }
  const step = Math.floor(atMs / 1000 / TOTP_STEP_SECONDS);
  const candidate = Buffer.from(code, 'utf8');
  for (const delta of [-1, 0, 1]) {
    const expected = Buffer.from(hotp(key, BigInt(step + delta)), 'utf8');
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return true;
  }
  return false;
};

export const buildOtpauthUrl = (secret: string, accountName: string, issuer = 'CAM LABS'): string => {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
};

/** Single-use numeric backup codes (returned once at enable time). */
export const generateBackupCodes = (count = 8): string[] => {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(String(randomInt(0, 100_000_000)).padStart(8, '0'));
  }
  return [...codes];
};
