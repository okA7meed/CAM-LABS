import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../config/database';
import { ApiResponseHelper } from '../utils/response';
import { AppError } from '../utils/errors';
import { hashPassword, validatePassword, verifyPassword } from '../auth/password.service';
import { createSession, deleteSession, extractSessionToken, SESSION_COOKIE_NAME } from '../auth/session.service';
import { requireAuth } from '../middleware/auth.middleware';
import { toSafeUser } from '../auth/types';
import { ROLES } from '../auth/roles';

const router = Router();

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

const phoneSchema = z.string().trim().regex(/^(?=.*\d)[0-9+() -]{7,40}$/, 'A valid phone number is required.');

const registrationSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(160).optional().default('Independent'),
  phone: phoneSchema,
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
        phone: data.phone,
      },
    });
    const session = await createSession(user.id);
    setSessionCookie(res, session.token, session.expiresAt);
    ApiResponseHelper.success(res, { user: toSafeUser(user) }, 'Account created successfully', 201);
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

    const session = await createSession(user.id);
    setSessionCookie(res, session.token, session.expiresAt);
    ApiResponseHelper.success(res, { user: toSafeUser(user) }, 'Login successful');
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

router.get('/me', requireAuth, (req: Request, res: Response) => {
  ApiResponseHelper.success(res, req.auth);
});

router.put('/profile', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const profileSchema = z.object({
      name: z.string().trim().min(2).max(120).optional(),
      company: z.string().trim().max(160).optional(),
      phone: phoneSchema.optional(),
      address: z.string().trim().max(300).optional(),
      preferences: z.record(z.string(), z.unknown()).optional(),
    });
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Invalid profile data.', 400, 'INVALID_INPUT');
    const data = parsed.data;
    const user = await getPrismaClient().user.update({
      where: { id: req.auth!.id },
      data: { ...data, preferences: data.preferences as Prisma.InputJsonValue | undefined },
    });
    ApiResponseHelper.success(res, toSafeUser(user), 'Profile updated');
  } catch (error) {
    next(error);
  }
});

export default router;
