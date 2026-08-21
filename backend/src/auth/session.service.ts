import { createHash, randomBytes } from 'node:crypto';
import { getPrismaClient } from '../config/database';
import { AuthenticatedRequestUser, toSafeUser } from './types';
import { ENV } from '../config/env';

export const SESSION_COOKIE_NAME = 'cam_labs_session';
export const SESSION_TTL_DAYS = ENV.SESSION_TTL_DAYS;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const createSession = async (userId: string): Promise<{ token: string; expiresAt: Date; sessionId: string }> => {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await getPrismaClient().session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });
  return { token, expiresAt, sessionId: session.id };
};

export const resolveSession = async (token: string): Promise<AuthenticatedRequestUser | null> => {
  const session = await getPrismaClient().session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date() || session.user.accountStatus !== 'ACTIVE') {
    if (session) await getPrismaClient().session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return { ...toSafeUser(session.user), sessionId: session.id };
};

export const deleteSession = async (token: string): Promise<void> => {
  await getPrismaClient().session.deleteMany({ where: { tokenHash: hashToken(token) } });
};

export const extractSessionToken = (cookieHeader: string | undefined, authorization: string | undefined): string | null => {
  const cookie = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (cookie) return decodeURIComponent(cookie.slice(`${SESSION_COOKIE_NAME}=`.length));
  if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length).trim() || null;
  return null;
};