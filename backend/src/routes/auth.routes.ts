import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../config/database';
import { ENV } from '../config/env';
import { ApiResponseHelper } from '../utils/response';
import { AppError } from '../utils/errors';
import { hashPassword, validatePassword, verifyPassword } from '../auth/password.service';
import { GENERIC_FORGOT_MESSAGE, PasswordResetService } from '../services/password-reset.service';
import { EmailChangeService } from '../services/email-change.service';
import { createSession, deleteSession, extractSessionToken, SESSION_COOKIE_NAME, SESSION_TTL_DAYS, SESSION_TTL_DAYS_SHORT } from '../auth/session.service';
import { buildOtpauthUrl, generateBackupCodes, generateTotpSecret, verifyTotpCode } from '../auth/totp';
import { normalizePhoneForWrite } from '../auth/phone';
import { requireAuth } from '../middleware/auth.middleware';
import { toSafeUser } from '../auth/types';
import { ROLES } from '../auth/roles';
import { AdminService } from '../services/admin.service';

const router = Router();

/** Egypt governorate whitelist shared with the quote/shipping flow. */
const GOVERNORATES = new Set([
  '6th of October', 'Al Shargia', 'Alexandria', 'Aswan', 'Asyut', 'Beheira',
  'Beni Suef', 'Cairo', 'Dakahlia', 'Damietta', 'Faiyum', 'Gharbia', 'Giza',
  'Helwan', 'Ismailia', 'Kafr el-Sheikh', 'Luxor', 'Matrouh', 'Minya',
  'Monufia', 'New Valley', 'North Sinai', 'Port Said', 'Qalyubia', 'Qena',
  'Red Sea', 'Sohag', 'South Sinai', 'Suez',
]);

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
  // 6-digit TOTP (or 8-digit backup code) — required only when 2FA is on.
  twoFactorCode: z.string().trim().regex(/^[0-9]{6,8}$/).optional(),
  // "Keep me signed in": true → full SESSION_TTL_DAYS; false → short session.
  rememberMe: z.boolean().optional().default(true),
});

const phoneSchema = z.string().trim().min(1).max(40);

const registrationSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(160).optional().default('Independent'),
  phone: phoneSchema.optional(),
});

const cookieOptions = (expiresAt?: Date) => [
  `${SESSION_COOKIE_NAME}=`,
  'Path=/',
  'HttpOnly',
  'SameSite=Lax',
  process.env.NODE_ENV === 'production' ? 'Secure' : '',
  expiresAt ? `Expires=${expiresAt.toUTCString()}` : 'Max-Age=0',
].filter(Boolean).join('; ');

const setSessionCookie = (res: Response, token: string, expiresAt: Date): void => {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}; Expires=${expiresAt.toUTCString()}`);
};

const clearSessionCookie = (res: Response): void => {
  res.setHeader('Set-Cookie', cookieOptions());
};

const parseBody = <T>(schema: z.ZodSchema<T>, body: unknown): T => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new AppError('Invalid authentication request.', 400, 'INVALID_INPUT');
  return parsed.data;
};

/** Display-only device metadata for the Active Sessions panel. */
const sessionDeviceMeta = (req: Request): { userAgent?: string; ipAddress?: string } => {
  const forwarded = req.headers['x-forwarded-for'];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0];
  return {
    userAgent: req.headers['user-agent']?.slice(0, 512),
    ipAddress: (firstForwarded?.trim() || req.socket?.remoteAddress)?.slice(0, 64),
  };
};

const hashBackupCode = (code: string): string => createHash('sha256').update(`cam-labs-2fa-backup:${code}`).digest('hex');

/**
 * Verifies the second factor for a 2FA-enabled user. Accepts a TOTP code or
 * a single-use backup code (which is consumed on success). Returns true when
 * 2FA is not enabled. Throws a TWO_FACTOR_REQUIRED AppError when enabled but
 * no usable code was supplied.
 */
const verifySecondFactor = async (
  prisma: ReturnType<typeof getPrismaClient>,
  user: { id: string; twoFactorEnabled: boolean; twoFactorSecret: string | null; twoFactorBackupCodes: unknown },
  code: string | undefined,
): Promise<boolean> => {
  if (!user.twoFactorEnabled) return true;
  if (!code) throw new AppError('Two-factor authentication code is required.', 401, 'TWO_FACTOR_REQUIRED');
  if (/^[0-9]{6}$/.test(code) && user.twoFactorSecret && verifyTotpCode(user.twoFactorSecret, code)) return true;
  if (/^[0-9]{8}$/.test(code) && Array.isArray(user.twoFactorBackupCodes)) {
    const digest = hashBackupCode(code);
    if ((user.twoFactorBackupCodes as unknown[]).includes(digest)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorBackupCodes: (user.twoFactorBackupCodes as string[]).filter((h) => h !== digest) },
      });
      return true;
    }
  }
  throw new AppError('Invalid two-factor authentication code.', 401, 'INVALID_TWO_FACTOR_CODE');
};

router.post('/register', async (req: Request, res: Response, next) => {
  try {
    const data = parseBody(registrationSchema, req.body);
    const passwordError = validatePassword(data.password);
    if (passwordError) throw new AppError(passwordError, 400, 'WEAK_PASSWORD');

    const email = data.email.toLowerCase();
    const prisma = getPrismaClient();
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new AppError('An account with these credentials already exists.', 409, 'ACCOUNT_EXISTS');

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email,
        passwordHash: await hashPassword(data.password),
        role: ROLES.CUSTOMER,
        accountStatus: 'ACTIVE',
        company: data.company,
        // Canonical E.164 storage; country-aware validation rejects
        // impossible/invalid numbers with UX-safe codes.
        phone: data.phone ? normalizePhoneForWrite(data.phone) : undefined,
      },
    });
    const session = await createSession(user.id, sessionDeviceMeta(req));
    setSessionCookie(res, session.token, session.expiresAt);
    ApiResponseHelper.success(res, { user: toSafeUser(user) }, 'Account created successfully', 201);

    // Real business event: a new customer successfully registered.
    void AdminService.notifySafely({
      type: 'USER_REGISTERED',
      entityType: 'USER',
      entityId: user.id,
      title: 'New Customer Registered',
      message: `${user.name} created a new account.`,
      metadata: {
        customerId: user.id,
        customerName: user.name,
        company: user.company,
        type: 'USER_REGISTERED',
      },
      priority: 'SUCCESS',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req: Request, res: Response, next) => {
  try {
    const data = parseBody(credentialsSchema, req.body);
    const user = await getPrismaClient().user.findUnique({ where: { email: data.email.toLowerCase() } });
    const validPassword = user?.passwordHash ? await verifyPassword(data.password, user.passwordHash) : false;
    if (!user || !validPassword || user.accountStatus !== 'ACTIVE') {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }
    await verifySecondFactor(getPrismaClient(), user, data.twoFactorCode);

    // Server-authoritative session lifetime: the client preference only
    // selects between the long and short policies, never an arbitrary TTL.
    const session = await createSession(
      user.id,
      sessionDeviceMeta(req),
      data.rememberMe ? SESSION_TTL_DAYS : SESSION_TTL_DAYS_SHORT,
    );
    setSessionCookie(res, session.token, session.expiresAt);
    ApiResponseHelper.success(res, { user: toSafeUser(user) }, 'Login successful');

    // Real business event: only a genuine successful *login* creates this —
    // never token validation, middleware probes, page loads or session refreshes.
    // Admin accounts sign in silently; the bell tracks customer activity.
    if (!user.isAdmin && user.role === ROLES.CUSTOMER) {
      void AdminService.notifySafely({
        type: 'USER_LOGIN',
        entityType: 'USER',
        entityId: user.id,
        title: 'Customer Signed In',
        message: `${user.name} signed in.`,
        metadata: {
          customerId: user.id,
          customerName: user.name,
          type: 'USER_LOGIN',
        },
        priority: 'INFO',
      });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req: Request, res: Response, next) => {
  try {
    const token = extractSessionToken(req.headers.cookie, req.headers.authorization);
    if (token) await deleteSession(token);
    clearSessionCookie(res);
    ApiResponseHelper.success(res, null, 'Logout successful');
  } catch (error) {
    next(error);
  }
});

/**
 * Google Identity Services (GIS) ID-token sign-in — "Continue with Google".
 *
 * The browser obtains a Google-signed ID token via GIS (client-side, public
 * VITE_GOOGLE_CLIENT_ID) and POSTs it here. The server validates the token
 * directly with Google over TLS (tokeninfo), enforces audience/expiry/email
 * verification, then resolves the CAM LABS account WITHOUT creating
 * duplicates:
 * - existing email (password or prior Google account) → authenticate it;
 * - unknown email → create a CUSTOMER account from trusted Google claims only
 *   (name/email). Company/phone are never fabricated; they stay defaults and
 *   the user can complete them in their profile.
 * No Google secret is accepted from, or stored in, the frontend.
 */
const googleCredentialSchema = z.object({
  credential: z.string().trim().min(16).max(8192),
  twoFactorCode: z.string().trim().regex(/^[0-9]{6,8}$/).optional(),
});

interface GoogleTokenInfo {
  aud?: string;
  exp?: string;
  email?: string;
  email_verified?: string | boolean;
  sub?: string;
  name?: string;
  picture?: string;
}

const verifyGoogleCredential = async (credential: string): Promise<GoogleTokenInfo> => {
  const clientId = ENV.GOOGLE_CLIENT_ID;
  if (!clientId) throw new AppError('Google sign-in is not configured.', 501, 'GOOGLE_NOT_CONFIGURED');
  let info: GoogleTokenInfo;
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { method: 'GET' },
    );
    if (!response.ok) throw new AppError('Invalid Google credential.', 401, 'INVALID_GOOGLE_CREDENTIAL');
    info = (await response.json()) as GoogleTokenInfo;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Google verification is temporarily unavailable.', 502, 'GOOGLE_VERIFICATION_FAILED');
  }
  if (!info.aud || info.aud !== clientId) {
    throw new AppError('Invalid Google credential.', 401, 'INVALID_GOOGLE_CREDENTIAL');
  }
  const expiresMs = Number(info.exp) * 1000;
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
    throw new AppError('Expired Google credential.', 401, 'INVALID_GOOGLE_CREDENTIAL');
  }
  const verified = info.email_verified === true || info.email_verified === 'true';
  if (!info.email || !verified || !info.sub) {
    throw new AppError('Google email verification is required.', 401, 'GOOGLE_EMAIL_UNVERIFIED');
  }
  return info;
};

router.post('/google', async (req: Request, res: Response, next) => {
  try {
    const parsed = googleCredentialSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Invalid Google authentication request.', 400, 'INVALID_INPUT');
    const info = await verifyGoogleCredential(parsed.data.credential);

    const email = String(info.email).trim().toLowerCase();
    const googleSub = String(info.sub);
    const prisma = getPrismaClient();
    // Stable identity first: a linked Google subject survives email changes.
    // Fall back to email matching for accounts created before linkage.
    const existingUser =
      (await prisma.user.findUnique({ where: { googleSub } }).catch(() => null)) ||
      (await prisma.user.findUnique({ where: { email } }));
    if (existingUser) {
      if (existingUser.accountStatus !== 'ACTIVE') {
        throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
      }
      // Backfill linkage for pre-linkage accounts on successful Google login.
      if (!existingUser.googleSub) {
        await prisma.user.update({ where: { id: existingUser.id }, data: { googleSub } }).catch(() => undefined);
      }
      await verifySecondFactor(prisma, existingUser, parsed.data.twoFactorCode);
      const session = await createSession(existingUser.id, sessionDeviceMeta(req));
      setSessionCookie(res, session.token, session.expiresAt);
      ApiResponseHelper.success(res, { user: toSafeUser(existingUser) }, 'Login successful');
      return;
    }

    const displayName = String(info.name || '').trim().slice(0, 120) || email.split('@')[0] || 'CAM LABS Engineer';
    const user = await prisma.user.create({
      data: {
        name: displayName,
        email,
        passwordHash: null,
        googleSub,
        role: ROLES.CUSTOMER,
        accountStatus: 'ACTIVE',
        company: 'Independent',
        phone: null,
      },
    });
    const session = await createSession(user.id, sessionDeviceMeta(req));
    setSessionCookie(res, session.token, session.expiresAt);
    ApiResponseHelper.success(res, { user: toSafeUser(user) }, 'Account created successfully', 201);

    void AdminService.notifySafely({
      type: 'USER_REGISTERED',
      entityType: 'USER',
      entityId: user.id,
      title: 'New Customer Registered',
      message: `${user.name} created a new account with Google.`,
      metadata: {
        customerId: user.id,
        customerName: user.name,
        company: user.company,
        type: 'USER_REGISTERED',
      },
      priority: 'SUCCESS',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
  ApiResponseHelper.success(res, req.auth);
});

// ─── Self-service password reset (6-digit email OTP) ──────────────────────
// Anti-enumeration: forgot-password always returns the same public response.

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254),
});

router.post('/forgot-password', async (req: Request, res: Response, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      // Malformed input gets the same generic message — no oracle.
      ApiResponseHelper.success(res, { message: GENERIC_FORGOT_MESSAGE }, GENERIC_FORGOT_MESSAGE);
      return;
    }
    const result = await PasswordResetService.requestReset(parsed.data.email);
    ApiResponseHelper.success(res, result, result.message);
  } catch (error) {
    next(error);
  }
});

const verifyResetCodeSchema = z.object({
  email: z.string().trim().email().max(254),
  code: z.string().trim().regex(/^[0-9]{6}$/, 'A 6-digit verification code is required.'),
});

router.post('/verify-reset-code', async (req: Request, res: Response, next) => {
  try {
    const parsed = verifyResetCodeSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Incorrect verification code.', 401, 'INVALID_RESET_CODE');
    const result = await PasswordResetService.verifyCode(parsed.data.email, parsed.data.code);
    ApiResponseHelper.success(res, result, 'Verification code accepted.');
  } catch (error) {
    next(error);
  }
});

const resetPasswordSchema = z.object({
  resetToken: z.string().trim().min(16).max(256),
  newPassword: z.string().min(1).max(128),
  confirmPassword: z.string().min(1).max(128),
});

router.post('/reset-password', async (req: Request, res: Response, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Invalid password reset request.', 400, 'INVALID_INPUT');
    if (parsed.data.newPassword !== parsed.data.confirmPassword) {
      throw new AppError('Passwords do not match.', 400, 'PASSWORD_MISMATCH');
    }
    await PasswordResetService.resetPassword(parsed.data.resetToken, parsed.data.newPassword);
    ApiResponseHelper.success(res, null, 'Password updated successfully.');
  } catch (error) {
    next(error);
  }
});

router.put('/profile', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const profileSchema = z.object({
      name: z.string().trim().min(2).max(120).optional(),
      company: z.string().trim().max(160).optional(),
      phone: phoneSchema.optional(),
      address: z.string().trim().max(300).optional(),
      taxId: z.string().trim().max(60).optional(),
      governorate: z.string().trim().max(60).optional(),
      city: z.string().trim().max(120).optional(),
      addressLine1: z.string().trim().max(300).optional(),
      addressLine2: z.string().trim().max(300).optional(),
      postalCode: z.string().trim().max(20).optional(),
      preferences: z.record(z.string(), z.unknown()).optional(),
    });
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Invalid profile data.', 400, 'INVALID_INPUT');
    const data = parsed.data;
    if (data.governorate && !GOVERNORATES.has(data.governorate)) {
      throw new AppError('Invalid governorate.', 400, 'INVALID_INPUT');
    }
    // Server-side merge: notification/address-book/theme preferences are
    // namespaced keys inside the JSON column, so partial updates from one
    // Account Settings section never wipe keys owned by another section.
    const prisma = getPrismaClient();
    const current = await prisma.user.findUnique({ where: { id: req.auth!.id } });
    if (!current) throw new AppError('Account not found.', 404, 'NOT_FOUND');
    const mergedPreferences =
      data.preferences === undefined
        ? undefined
        : ({ ...((current.preferences as Record<string, unknown> | null) ?? {}), ...data.preferences } as Prisma.InputJsonValue);
    const { preferences: _ignored, ...rest } = data;
    const user = await prisma.user.update({
      where: { id: req.auth!.id },
      data: {
        ...rest,
        // Country-aware validation + E.164 normalization on every write.
        // Legacy stored values are never rewritten unless the user saves.
        ...(rest.phone !== undefined ? { phone: normalizePhoneForWrite(rest.phone) } : {}),
        preferences: mergedPreferences,
      },
    });
    ApiResponseHelper.success(res, toSafeUser(user), 'Profile updated');
  } catch (error) {
    next(error);
  }
});

// ─── Authenticated password change ──────────────────────────────────────
// Requires the current password; never accepts a new password alone.

router.post('/change-password', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1).max(128),
      newPassword: z.string().min(1).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Invalid password change request.', 400, 'INVALID_INPUT');
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { id: req.auth!.id } });
    if (!user || !user.passwordHash || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      throw new AppError('Your current password is incorrect.', 401, 'INVALID_CURRENT_PASSWORD');
    }
    const strengthError = validatePassword(parsed.data.newPassword);
    if (strengthError) throw new AppError(strengthError, 400, 'WEAK_PASSWORD');
    if (await verifyPassword(parsed.data.newPassword, user.passwordHash)) {
      throw new AppError('The new password must be different from the current password.', 400, 'PASSWORD_REUSE');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    });
    ApiResponseHelper.success(res, null, 'Password updated successfully.');
  } catch (error) {
    next(error);
  }
});

// ─── Verified work-email change ────────────────────────────────────────
// The login email is never written directly. Step 1 confirms identity
// (current password for password accounts) and mails a 6-digit OTP to the
// NEW address; step 2 verifies it and atomically swaps the email. Google
// linkage (`googleSub`) is untouched, so OAuth sign-in survives the change.

router.post('/email/change-request', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const schema = z.object({
      newEmail: z.string().trim().email().max(254),
      password: z.string().min(1).max(128).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Please enter a valid email address.', 400, 'INVALID_EMAIL');
    const result = await EmailChangeService.requestChange(req.auth!.id, parsed.data.newEmail, parsed.data.password);
    ApiResponseHelper.success(res, result, 'Verification code sent.');
  } catch (error) {
    next(error);
  }
});

router.post('/email/change-verify', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const schema = z.object({ code: z.string().trim().min(1).max(16) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Incorrect verification code.', 401, 'INVALID_EMAIL_CODE');
    const user = await EmailChangeService.verifyChange(req.auth!.id, parsed.data.code);
    ApiResponseHelper.success(res, { user }, 'Login email updated successfully.');
  } catch (error) {
    next(error);
  }
});

// ─── Two-factor authentication (TOTP) ───────────────────────────────────
// Real RFC 6238 time-based one-time passwords. Secrets are generated and
// verified server-side only; clients receive the secret once (at setup) and
// single-use backup codes once (at enable). Nothing secret is ever returned
// by /auth/me or any other read endpoint (see toSafeUser).

router.get('/2fa/status', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const user = await getPrismaClient().user.findUnique({ where: { id: req.auth!.id } });
    if (!user) throw new AppError('Account not found.', 404, 'NOT_FOUND');
    ApiResponseHelper.success(res, { enabled: user.twoFactorEnabled });
  } catch (error) {
    next(error);
  }
});

router.post('/2fa/setup', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { id: req.auth!.id } });
    if (!user) throw new AppError('Account not found.', 404, 'NOT_FOUND');
    if (user.twoFactorEnabled) throw new AppError('Two-factor authentication is already enabled.', 409, 'TWO_FACTOR_ACTIVE');
    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorPendingSecret: secret,
        twoFactorPendingExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    ApiResponseHelper.success(
      res,
      { secret, otpauthUrl: buildOtpauthUrl(secret, user.email) },
      'Scan the code with your authenticator app, then confirm.',
    );
  } catch (error) {
    next(error);
  }
});

router.post('/2fa/enable', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const parsed = z.object({ code: z.string().trim().regex(/^[0-9]{6}$/) }).safeParse(req.body);
    if (!parsed.success) throw new AppError('A 6-digit verification code is required.', 400, 'INVALID_INPUT');
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { id: req.auth!.id } });
    if (!user) throw new AppError('Account not found.', 404, 'NOT_FOUND');
    if (user.twoFactorEnabled) throw new AppError('Two-factor authentication is already enabled.', 409, 'TWO_FACTOR_ACTIVE');
    if (!user.twoFactorPendingSecret || !user.twoFactorPendingExpiresAt || user.twoFactorPendingExpiresAt <= new Date()) {
      throw new AppError('The setup session has expired. Please start setup again.', 410, 'TWO_FACTOR_SETUP_EXPIRED');
    }
    if (!verifyTotpCode(user.twoFactorPendingSecret, parsed.data.code)) {
      throw new AppError('Incorrect verification code.', 401, 'INVALID_TWO_FACTOR_CODE');
    }
    const backupCodes = generateBackupCodes();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: user.twoFactorPendingSecret,
        twoFactorPendingSecret: null,
        twoFactorPendingExpiresAt: null,
        twoFactorBackupCodes: backupCodes.map(hashBackupCode),
      },
    });
    ApiResponseHelper.success(res, { backupCodes }, 'Two-factor authentication enabled.');
  } catch (error) {
    next(error);
  }
});

router.post('/2fa/disable', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const parsed = z.object({ password: z.string().min(1).max(128) }).safeParse(req.body);
    if (!parsed.success) throw new AppError('Your password is required to disable two-factor authentication.', 400, 'INVALID_INPUT');
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { id: req.auth!.id } });
    if (!user) throw new AppError('Account not found.', 404, 'NOT_FOUND');
    if (!user.twoFactorEnabled) throw new AppError('Two-factor authentication is not enabled.', 409, 'TWO_FACTOR_INACTIVE');
    if (!user.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      throw new AppError('Your password is incorrect.', 401, 'INVALID_CURRENT_PASSWORD');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorPendingSecret: null,
        twoFactorPendingExpiresAt: null,
        twoFactorBackupCodes: [],
      },
    });
    ApiResponseHelper.success(res, null, 'Two-factor authentication disabled.');
  } catch (error) {
    next(error);
  }
});

// ─── Active sessions ────────────────────────────────────────────────────
// Lists the caller's own sessions (display metadata only) and revokes them.
// Ownership is enforced by userId scoping; the current session is resolved
// from req.auth.sessionId and can never be revoked through these endpoints
// (global logout remains the flow for the current session).

const toSafeSession = (session: {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  createdAt: Date;
}) => ({
  id: session.id,
  device: session.userAgent,
  ipAddress: session.ipAddress,
  expiresAt: session.expiresAt.toISOString(),
  createdAt: session.createdAt.toISOString(),
});

router.get('/sessions', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const sessions = await getPrismaClient().session.findMany({
      where: { userId: req.auth!.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    ApiResponseHelper.success(res, {
      sessions: sessions.map((s) => ({ ...toSafeSession(s), current: s.id === req.auth!.sessionId })),
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/sessions/:id', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const sessionId = String(req.params.id);
    if (sessionId === req.auth!.sessionId) {
      throw new AppError('Use logout to end your current session.', 400, 'CURRENT_SESSION');
    }
    const removed = await getPrismaClient().session.deleteMany({
      where: { id: sessionId, userId: req.auth!.id },
    });
    if (removed.count === 0) throw new AppError('Session not found.', 404, 'NOT_FOUND');
    ApiResponseHelper.success(res, null, 'Session signed out.');
  } catch (error) {
    next(error);
  }
});

router.post('/sessions/revoke-others', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const removed = await getPrismaClient().session.deleteMany({
      where: { userId: req.auth!.id, id: { not: req.auth!.sessionId } },
    });
    ApiResponseHelper.success(res, { revoked: removed.count }, 'All other sessions signed out.');
  } catch (error) {
    next(error);
  }
});

// ─── Customer address book ──────────────────────────────────────────────
// Stored as namespaced keys inside the existing User.preferences JSON column
// (no new table; no historical data touched). Historical quotes/orders keep
// their own shipping snapshots, so editing the book never rewrites history.
// The whole book is replaced in a single UPDATE — default assignment is
// therefore atomic and a user can never end up with two defaults.

const addressSchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(2).max(60),
  street: z.string().trim().min(2).max(200),
  building: z.string().trim().max(120).optional().default(''),
  area: z.string().trim().max(120).optional().default(''),
  city: z.string().trim().min(2).max(120),
  governorate: z.string().trim().min(2).max(60),
  postalCode: z.string().trim().max(20).optional().default(''),
  deliveryNotes: z.string().trim().max(300).optional().default(''),
});

const readAddressBook = (preferences: unknown): { addresses: z.infer<typeof addressSchema>[]; defaultAddressId: string | null } => {
  const prefs = (preferences ?? {}) as Record<string, unknown>;
  const addresses = Array.isArray(prefs.addressBook) ? (prefs.addressBook as z.infer<typeof addressSchema>[]) : [];
  const defaultAddressId = typeof prefs.defaultAddressId === 'string' ? prefs.defaultAddressId : null;
  return { addresses, defaultAddressId };
};

router.get('/addresses', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const user = await getPrismaClient().user.findUnique({ where: { id: req.auth!.id } });
    if (!user) throw new AppError('Account not found.', 404, 'NOT_FOUND');
    ApiResponseHelper.success(res, readAddressBook(user.preferences));
  } catch (error) {
    next(error);
  }
});

router.put('/addresses', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const parsed = z
      .object({
        addresses: z.array(addressSchema).max(10),
        defaultAddressId: z.string().trim().max(64).nullable().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) throw new AppError('Invalid address data.', 400, 'INVALID_INPUT');
    const ids = new Set(parsed.data.addresses.map((a) => a.id));
    if (ids.size !== parsed.data.addresses.length) throw new AppError('Duplicate address identifiers.', 400, 'INVALID_INPUT');
    for (const address of parsed.data.addresses) {
      if (!GOVERNORATES.has(address.governorate)) throw new AppError(`Invalid governorate: ${address.governorate}.`, 400, 'INVALID_INPUT');
    }
    const defaultAddressId = parsed.data.defaultAddressId ?? null;
    if (defaultAddressId !== null && !ids.has(defaultAddressId)) {
      throw new AppError('The default address must be one of your saved addresses.', 400, 'INVALID_INPUT');
    }
    const prisma = getPrismaClient();
    const current = await prisma.user.findUnique({ where: { id: req.auth!.id } });
    if (!current) throw new AppError('Account not found.', 404, 'NOT_FOUND');
    const merged = {
      ...((current.preferences as Record<string, unknown> | null) ?? {}),
      addressBook: parsed.data.addresses,
      defaultAddressId,
    } as Prisma.InputJsonValue;
    await prisma.user.update({ where: { id: req.auth!.id }, data: { preferences: merged } });
    ApiResponseHelper.success(res, { addresses: parsed.data.addresses, defaultAddressId }, 'Addresses saved.');
  } catch (error) {
    next(error);
  }
});

export default router;
