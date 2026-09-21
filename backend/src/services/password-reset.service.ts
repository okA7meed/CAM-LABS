import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { getPrismaClient } from '../config/database';
import { ENV } from '../config/env';
import { AppError } from '../utils/errors';
import { Logger } from '../utils/logger';
import { hashPassword, validatePassword } from '../auth/password.service';
import { EmailService } from './email.service';

/**
 * Self-service password reset via 6-digit email OTP + single-use reset
 * authorization, persisted in `password_reset_challenges`.
 *
 * Security model (mirrors the existing opaque server-side session design):
 * - The OTP is cryptographically random (never Math.random) and is stored
 *   only as an HMAC-SHA256 digest keyed by a server-secret pepper, so a
 *   database read alone cannot recover codes (6 digits = low entropy).
 * - The reset authorization is an opaque `challengeId.secret` token whose
 *   secret is likewise stored only as an HMAC digest.
 * - Single-use transitions are enforced with conditional `updateMany`
 *   writes (affected-row count decides), so concurrent requests cannot both
 *   consume the same OTP or reset authorization.
 * - Nothing sensitive (OTP, digests, tokens, API keys) is ever logged.
 */

const OTP_LENGTH = 6;

let pepperWarned = false;
const getPepper = (): string => {
  if (ENV.PASSWORD_RESET_PEPPER) return ENV.PASSWORD_RESET_PEPPER;
  // Safe fallback: a per-process pepper keeps digests keyed (DB reads alone
  // stay useless) at the cost of invalidating outstanding codes on restart.
  // Production deployments must set PASSWORD_RESET_PEPPER.
  if (!pepperWarned) {
    pepperWarned = true;
    Logger.warn('[PasswordReset] PASSWORD_RESET_PEPPER is not set; using an ephemeral process pepper.');
  }
  if (!process.env.__CAM_LABS_EPHEMERAL_PEPPER) {
    process.env.__CAM_LABS_EPHEMERAL_PEPPER = randomBytes(32).toString('hex');
  }
  return process.env.__CAM_LABS_EPHEMERAL_PEPPER as string;
};

/** Cryptographically secure 6-digit code; leading zeros preserved. */
export const generateOtpCode = (): string =>
  randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, '0');

const digestSecret = (challengeId: string, secret: string): string =>
  createHmac('sha256', getPepper()).update(`${challengeId}:${secret}`).digest('hex');

const digestsEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
};

const generateOpaqueSecret = (): string => randomBytes(32).toString('base64url');

const parseResetToken = (token: string): { challengeId: string; secret: string } | null => {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot >= token.length - 1) return null;
  const challengeId = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  if (!/^[0-9a-fA-F-]{10,64}$/.test(challengeId) || !/^[A-Za-z0-9_-]{32,128}$/.test(secret)) return null;
  return { challengeId, secret };
};

const minutesFromNow = (minutes: number): Date => new Date(Date.now() + minutes * 60 * 1000);
const secondsAgo = (seconds: number): Date => new Date(Date.now() - seconds * 1000);

export const GENERIC_FORGOT_MESSAGE = 'If an account exists for this email, a verification code has been sent.';

export const PasswordResetService = {
  /**
   * Starts (or silently rate-limits) a reset flow. ALWAYS resolves normally
   * with the same public message so the response never reveals whether the
   * account exists, its method, or its cooldown state. Email delivery
   * failures are logged server-side and likewise hidden from the caller.
   */
  requestReset: async (email: string): Promise<{ message: string }> => {
    const normalized = email.trim().toLowerCase();
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { email: normalized } });

    if (user && user.accountStatus === 'ACTIVE') {
      const now = new Date();
      // Lazy cleanup of this user's dead challenges (expired OTPs, consumed
      // authorizations, stale verified-but-unused authorizations).
      await prisma.passwordResetChallenge
        .deleteMany({
          where: {
            userId: user.id,
            OR: [
              { verifiedAt: null, expiresAt: { lt: now } },
              { usedAt: { not: null } },
              { verifiedAt: { not: null }, usedAt: null, resetTokenExpiresAt: { lt: now } },
            ],
          },
        })
        .catch(() => undefined);

      // Authoritative resend cooldown: a fresh request inside the window is
      // silently absorbed (same public response) — refreshing the page or
      // calling the endpoint manually cannot bypass it.
      const recent = await prisma.passwordResetChallenge.findFirst({
        where: { userId: user.id, usedAt: null, createdAt: { gt: secondsAgo(ENV.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS) } },
        orderBy: { createdAt: 'desc' },
      });
      if (!recent) {
        // A new OTP invalidates every outstanding challenge for this user.
        const past = new Date(0);
        await prisma.passwordResetChallenge.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { expiresAt: past, resetTokenExpiresAt: past },
        });
        const code = generateOtpCode();
        const created = await prisma.passwordResetChallenge.create({
          data: {
            userId: user.id,
            codeDigest: '', // set below once the id exists (id salts the digest)
            expiresAt: minutesFromNow(ENV.PASSWORD_RESET_OTP_TTL_MINUTES),
          },
        });
        await prisma.passwordResetChallenge.update({
          where: { id: created.id },
          data: { codeDigest: digestSecret(created.id, code) },
        });
        try {
          await EmailService.sendPasswordResetCode(user.email, code);
        } catch (error) {
          // Anti-enumeration: delivery problems stay server-side. The
          // challenge persists so a later resend (after cooldown) retries.
          Logger.error(
            '[PasswordReset] Code email failed:',
            error instanceof AppError ? error.code : 'unknown',
          );
        }
      }
    }
    return { message: GENERIC_FORGOT_MESSAGE };
  },

  /**
   * Verifies an OTP and, on success, issues a short-lived single-use opaque
   * reset authorization. Error messages are UX-safe and never disclose
   * account existence, method, or internal state.
   */
  verifyCode: async (email: string, code: string): Promise<{ resetToken: string; expiresInMinutes: number }> => {
    const normalized = email.trim().toLowerCase();
    const prisma = getPrismaClient();
    const invalidError = new AppError('Incorrect verification code.', 401, 'INVALID_RESET_CODE');

    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (!user || user.accountStatus !== 'ACTIVE') throw invalidError;

    const now = new Date();
    const challenge = await prisma.passwordResetChallenge.findFirst({
      where: { userId: user.id, verifiedAt: null, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) {
      throw new AppError('Verification code has expired. Request a new code.', 401, 'RESET_CODE_EXPIRED');
    }
    // Attempt cap is checked before expiry so a locked challenge reports a
    // stable locked message instead of flipping to "expired".
    if (challenge.attempts >= ENV.PASSWORD_RESET_MAX_ATTEMPTS) {
      await prisma.passwordResetChallenge.updateMany({
        where: { id: challenge.id, verifiedAt: null },
        data: { expiresAt: new Date(0) },
      });
      throw new AppError('Too many attempts. Request a new code.', 429, 'RESET_CODE_LOCKED');
    }
    if (challenge.expiresAt <= now) {
      throw new AppError('Verification code has expired. Request a new code.', 401, 'RESET_CODE_EXPIRED');
    }

    const updated = await prisma.passwordResetChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    if (!digestsEqual(digestSecret(challenge.id, code), challenge.codeDigest)) {
      if (updated.attempts >= ENV.PASSWORD_RESET_MAX_ATTEMPTS) {
        await prisma.passwordResetChallenge.updateMany({
          where: { id: challenge.id, verifiedAt: null },
          data: { expiresAt: new Date(0) },
        });
        throw new AppError('Too many attempts. Request a new code.', 429, 'RESET_CODE_LOCKED');
      }
      throw invalidError;
    }

    // Atomically claim the OTP: exactly one concurrent verifier can win.
    const secret = generateOpaqueSecret();
    const claimed = await prisma.passwordResetChallenge.updateMany({
      where: { id: challenge.id, verifiedAt: null, usedAt: null },
      data: {
        verifiedAt: now,
        resetTokenDigest: digestSecret(challenge.id, secret),
        resetTokenExpiresAt: minutesFromNow(ENV.PASSWORD_RESET_TOKEN_TTL_MINUTES),
      },
    });
    if (claimed.count !== 1) throw invalidError;

    return { resetToken: `${challenge.id}.${secret}`, expiresInMinutes: ENV.PASSWORD_RESET_TOKEN_TTL_MINUTES };
  },

  /**
   * Consumes a reset authorization and sets the new password. Transactional:
   * authorization consumption, password update, challenge invalidation, and
   * session invalidation complete atomically; the conditional consume makes
   * concurrent use of one token impossible (only one request wins).
   */
  resetPassword: async (resetToken: string, newPassword: string): Promise<void> => {
    const parsed = parseResetToken(resetToken);
    const invalidError = new AppError('Password reset session is invalid or has expired.', 401, 'INVALID_RESET_TOKEN');
    if (!parsed) throw invalidError;

    const prisma = getPrismaClient();
    const challenge = await prisma.passwordResetChallenge.findUnique({ where: { id: parsed.challengeId } });
    const now = new Date();
    if (
      !challenge ||
      !challenge.verifiedAt ||
      challenge.usedAt ||
      !challenge.resetTokenDigest ||
      !challenge.resetTokenExpiresAt ||
      challenge.resetTokenExpiresAt <= now ||
      !digestsEqual(digestSecret(challenge.id, parsed.secret), challenge.resetTokenDigest)
    ) {
      throw invalidError;
    }

    const policyError = validatePassword(newPassword);
    if (policyError) throw new AppError(policyError, 400, 'WEAK_PASSWORD');

    const passwordHash = await hashPassword(newPassword);
    const past = new Date(0);
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetChallenge.updateMany({
        where: { id: challenge.id, usedAt: null },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) throw invalidError;
      await tx.user.update({ where: { id: challenge.userId }, data: { passwordHash } });
      await tx.passwordResetChallenge.updateMany({
        where: { userId: challenge.userId, id: { not: challenge.id }, usedAt: null },
        data: { expiresAt: past, resetTokenExpiresAt: past },
      });
      // A password reset is a security event: every session for this user
      // dies, including the current one. Other users are unaffected.
      await tx.session.deleteMany({ where: { userId: challenge.userId } });
    });
  },
};
