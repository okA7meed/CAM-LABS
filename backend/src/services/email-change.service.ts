import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { getPrismaClient } from '../config/database';
import { ENV } from '../config/env';
import { AppError } from '../utils/errors';
import { Logger } from '../utils/logger';
import { verifyPassword } from '../auth/password.service';
import { EmailService } from './email.service';
import { toSafeUser } from '../auth/types';

/**
 * Verified work-email change for Account Settings.
 *
 * Security model (mirrors password-reset.service.ts):
 * - The login email is never written directly. A 6-digit OTP is sent to the
 *   NEW address; only its HMAC-SHA256 digest (peppered, id-salted) persists.
 * - Identity confirmation: accounts with a password must present it;
 *   OAuth-only accounts are authenticated by the session (same sensitivity
 *   level as the rest of the account surface) and stay linked to Google via
 *   the stable `googleSub`, so the change cannot orphan their login.
 * - Duplicate collision is rejected explicitly (409 EMAIL_TAKEN) and
 *   re-checked at commit time; the final write is a conditional
 *   `updateMany` so concurrent verifies cannot both win, and a unique
 *   violation still resolves safely.
 * - Attempt caps, TTL, resend cooldown, single-use transitions, and
 *   no-secret logging all mirror the reset flow.
 */

const OTP_LENGTH = 6;

let pepperWarned = false;
const getPepper = (): string => {
  if (ENV.PASSWORD_RESET_PEPPER) return ENV.PASSWORD_RESET_PEPPER;
  if (!pepperWarned) {
    pepperWarned = true;
    Logger.warn('[EmailChange] PASSWORD_RESET_PEPPER is not set; using an ephemeral process pepper.');
  }
  if (!process.env.__CAM_LABS_EPHEMERAL_PEPPER) {
    process.env.__CAM_LABS_EPHEMERAL_PEPPER = randomBytes(32).toString('hex');
  }
  return process.env.__CAM_LABS_EPHEMERAL_PEPPER as string;
};

const generateOtpCode = (): string =>
  randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, '0');

const digestCode = (challengeId: string, code: string): string =>
  createHmac('sha256', getPepper()).update(`${challengeId}:${code}`).digest('hex');

const digestsEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
};

const minutesFromNow = (minutes: number): Date => new Date(Date.now() + minutes * 60 * 1000);
const secondsAgo = (seconds: number): Date => new Date(Date.now() - seconds * 1000);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EmailChangeService = {
  /**
   * Starts a change toward `newEmail`. Returns the obfuscated target so the
   * UI can prompt for the code without ever echoing the full address.
   */
  requestChange: async (
    userId: string,
    newEmail: string,
    password?: string,
  ): Promise<{ obfuscatedEmail: string; expiresInMinutes: number }> => {
    const normalized = newEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized) || normalized.length > 254) {
      throw new AppError('Please enter a valid email address.', 400, 'INVALID_EMAIL');
    }
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.accountStatus !== 'ACTIVE') throw new AppError('Account not found.', 404, 'NOT_FOUND');
    if (normalized === user.email.toLowerCase()) {
      throw new AppError('This is already your login email.', 400, 'EMAIL_UNCHANGED');
    }
    const taken = await prisma.user.findUnique({ where: { email: normalized } });
    if (taken) throw new AppError('This email is already assigned to another account.', 409, 'EMAIL_TAKEN');
    // Identity confirmation for password accounts.
    if (user.passwordHash) {
      if (!password || !(await verifyPassword(password, user.passwordHash))) {
        throw new AppError('Your current password is incorrect.', 401, 'INVALID_CURRENT_PASSWORD');
      }
    }

    const now = new Date();
    await prisma.emailChangeChallenge
      .deleteMany({ where: { userId: user.id, OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }] } })
      .catch(() => undefined);

    // Resend cooldown: a fresh request inside the window is absorbed and the
    // outstanding code stays valid (no inbox flooding via repeated clicks).
    const recent = await prisma.emailChangeChallenge.findFirst({
      where: { userId: user.id, usedAt: null, createdAt: { gt: secondsAgo(ENV.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS) } },
      orderBy: { createdAt: 'desc' },
    });
    let challenge = recent;
    if (!challenge) {
      // A new request invalidates every outstanding challenge for this user.
      const past = new Date(0);
      await prisma.emailChangeChallenge.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { expiresAt: past },
      });
      const code = generateOtpCode();
      const created = await prisma.emailChangeChallenge.create({
        data: {
          userId: user.id,
          newEmail: normalized,
          codeDigest: '',
          expiresAt: minutesFromNow(ENV.PASSWORD_RESET_OTP_TTL_MINUTES),
        },
      });
      await prisma.emailChangeChallenge.update({
        where: { id: created.id },
        data: { codeDigest: digestCode(created.id, code) },
      });
      challenge = { ...created, codeDigest: digestCode(created.id, code) };
      try {
        await EmailService.sendVerificationCode(normalized, code, 'Email Change Verification');
      } catch (error) {
        Logger.error('[EmailChange] Code email failed:', error instanceof AppError ? error.code : 'unknown');
        throw new AppError('The verification email could not be sent. Please try again.', 502, 'EMAIL_SEND_FAILED');
      }
    }
    const [local, domain] = (challenge?.newEmail || normalized).split('@');
    return {
      obfuscatedEmail: `${(local || '').slice(0, 2)}•••@${domain || ''}`,
      expiresInMinutes: ENV.PASSWORD_RESET_OTP_TTL_MINUTES,
    };
  },

  /**
   * Verifies the OTP and atomically swaps the login email. Returns the
   * refreshed safe user for the client store.
   */
  verifyChange: async (userId: string, code: string) => {
    const invalidError = new AppError('Incorrect verification code.', 401, 'INVALID_EMAIL_CODE');
    if (!/^[0-9]{6}$/.test((code || '').trim())) throw invalidError;
    const prisma = getPrismaClient();
    const now = new Date();
    const challenge = await prisma.emailChangeChallenge.findFirst({
      where: { userId, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) throw new AppError('Verification code has expired. Request a new code.', 401, 'EMAIL_CODE_EXPIRED');
    if (challenge.attempts >= ENV.PASSWORD_RESET_MAX_ATTEMPTS) {
      await prisma.emailChangeChallenge.updateMany({
        where: { id: challenge.id, usedAt: null },
        data: { expiresAt: new Date(0) },
      });
      throw new AppError('Too many attempts. Request a new code.', 429, 'EMAIL_CODE_LOCKED');
    }
    if (challenge.expiresAt <= now) {
      throw new AppError('Verification code has expired. Request a new code.', 401, 'EMAIL_CODE_EXPIRED');
    }
    const updated = await prisma.emailChangeChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    if (!digestsEqual(digestCode(challenge.id, code.trim()), challenge.codeDigest)) {
      if (updated.attempts >= ENV.PASSWORD_RESET_MAX_ATTEMPTS) {
        await prisma.emailChangeChallenge.updateMany({
          where: { id: challenge.id, usedAt: null },
          data: { expiresAt: new Date(0) },
        });
        throw new AppError('Too many attempts. Request a new code.', 429, 'EMAIL_CODE_LOCKED');
      }
      throw invalidError;
    }

    // Re-check collision at commit time, then claim atomically: exactly one
    // concurrent verifier can consume the challenge and move the email.
    const collision = await prisma.user.findUnique({ where: { email: challenge.newEmail } });
    if (collision && collision.id !== userId) {
      throw new AppError('This email was just assigned to another account.', 409, 'EMAIL_TAKEN');
    }
    try {
      const claimed = await prisma.$transaction(async (tx) => {
        const consumed = await tx.emailChangeChallenge.updateMany({
          where: { id: challenge.id, usedAt: null },
          data: { usedAt: now },
        });
        if (consumed.count !== 1) throw invalidError;
        const moved = await tx.user.updateMany({
          where: { id: userId },
          data: { email: challenge.newEmail },
        });
        if (moved.count !== 1) throw invalidError;
        return tx.user.findUnique({ where: { id: userId } });
      });
      if (!claimed) throw invalidError;
      return toSafeUser(claimed);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if ((error as { code?: string }).code === 'P2002') {
        throw new AppError('This email is already assigned to another account.', 409, 'EMAIL_TAKEN');
      }
      throw error;
    }
  },
};
