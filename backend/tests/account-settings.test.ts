import express from 'express';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const user = {
    id: 'user-1',
    name: 'Test Engineer',
    email: 'test@example.com',
    role: 'CUSTOMER',
    isAdmin: false,
    accountStatus: 'ACTIVE',
    company: 'Test Co',
    phone: null,
    avatar: null,
    tier: 'Pro Engineer',
    address: null,
    taxId: null,
    preferences: null as unknown,
    passwordHash: '',
    twoFactorEnabled: false,
    twoFactorSecret: null as string | null,
    twoFactorPendingSecret: null as string | null,
    twoFactorPendingExpiresAt: null as Date | null,
    twoFactorBackupCodes: [] as string[],
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const sessions = new Map<string, { id: string; userId: string; tokenHash: string; userAgent: string | null; ipAddress: string | null; expiresAt: Date; createdAt: Date }>();
  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email === user.email || where.id === user.id) return { ...user };
        return null;
      }),
      create: vi.fn(async ({ data }: { data: Partial<typeof user> }) => ({ ...user, ...data })),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<typeof user> }) => {
        if (where.id !== user.id) throw new Error('not found');
        Object.assign(user, data);
        return { ...user };
      }),
    },
    session: {
      create: vi.fn(async ({ data }: { data: { tokenHash: string; userId: string; expiresAt: Date; userAgent?: string | null; ipAddress?: string | null } }) => {
        const session = {
          id: `session-${sessions.size + 1}`,
          userAgent: data.userAgent ?? null,
          ipAddress: data.ipAddress ?? null,
          createdAt: new Date(),
          ...data,
        };
        sessions.set(data.tokenHash, session);
        return session;
      }),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.get(where.tokenHash);
        return session ? { ...session, user: { ...user } } : null;
      }),
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) => {
        return [...sessions.values()].filter((s) => s.userId === where.userId);
      }),
      delete: vi.fn(async () => undefined),
      deleteMany: vi.fn(async ({ where }: { where: { id?: string | { not: string }; userId: string } }) => {
        let count = 0;
        for (const [hash, session] of sessions) {
          if (session.userId !== where.userId) continue;
          if (typeof where.id === 'string' && session.id !== where.id) continue;
          if (typeof where.id === 'object' && where.id && 'not' in where.id && session.id === (where.id as { not: string }).not) continue;
          sessions.delete(hash);
          count += 1;
        }
        return { count };
      }),
    },
    auditLog: { create: vi.fn(async () => ({ id: 'log-1' })) },
  };
  return { user, sessions, prisma };
});

vi.mock('../src/config/database', () => ({ getPrismaClient: () => state.prisma }));

import authRoutes from '../src/routes/auth.routes';
import { errorHandler } from '../src/middleware/error.middleware';
import { hashPassword } from '../src/auth/password.service';
import { currentTotpCode } from '../src/auth/totp';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const seedSession = (token: string, id = 'session-current') => {
  state.sessions.set(hashToken(token), {
    id,
    userId: state.user.id,
    tokenHash: hashToken(token),
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
    expiresAt: new Date(Date.now() + 3600_000),
    createdAt: new Date(),
  });
};

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use(errorHandler);
  return app;
};

const CURRENT_TOKEN = 'current-token';
const authCookie = (token = CURRENT_TOKEN) => `cam_labs_session=${token}`;

describe('account settings — password change', () => {
  beforeEach(async () => {
    state.sessions.clear();
    seedSession(CURRENT_TOKEN);
    state.user.passwordHash = await hashPassword('ValidPass1');
    state.user.twoFactorEnabled = false;
    state.user.twoFactorSecret = null;
    state.prisma.user.update.mockClear();
  });

  it('rejects a wrong current password', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/auth/change-password')
      .set('Cookie', authCookie())
      .send({ currentPassword: 'WrongPass1', newPassword: 'NewValidPass1' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  it('rejects weak and reused passwords', async () => {
    const weak = await request(createTestApp())
      .post('/api/v1/auth/change-password')
      .set('Cookie', authCookie())
      .send({ currentPassword: 'ValidPass1', newPassword: 'short' });
    const reused = await request(createTestApp())
      .post('/api/v1/auth/change-password')
      .set('Cookie', authCookie())
      .send({ currentPassword: 'ValidPass1', newPassword: 'ValidPass1' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('WEAK_PASSWORD');
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe('PASSWORD_REUSE');
  });

  it('updates the password hash on success', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/auth/change-password')
      .set('Cookie', authCookie())
      .send({ currentPassword: 'ValidPass1', newPassword: 'BrandNewPass1' });
    expect(response.status).toBe(200);
    expect(state.prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user-1' } }));
  });
});

describe('account settings — two-factor authentication', () => {
  beforeEach(async () => {
    state.sessions.clear();
    seedSession(CURRENT_TOKEN);
    state.user.passwordHash = await hashPassword('ValidPass1');
    state.user.twoFactorEnabled = false;
    state.user.twoFactorSecret = null;
    state.user.twoFactorPendingSecret = null;
    state.user.twoFactorPendingExpiresAt = null;
    state.user.twoFactorBackupCodes = [];
  });

  it('runs setup → enable and never exposes secrets on read endpoints', async () => {
    const app = createTestApp();
    const setup = await request(app).post('/api/v1/auth/2fa/setup').set('Cookie', authCookie());
    expect(setup.status).toBe(200);
    expect(typeof setup.body.data.secret).toBe('string');
    expect(setup.body.data.otpauthUrl).toContain('otpauth://totp/');

    const wrong = await request(app).post('/api/v1/auth/2fa/enable').set('Cookie', authCookie()).send({ code: '000000' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_TWO_FACTOR_CODE');

    const secret = setup.body.data.secret as string;
    const enabled = await request(app)
      .post('/api/v1/auth/2fa/enable')
      .set('Cookie', authCookie())
      .send({ code: currentTotpCode(secret) });
    expect(enabled.status).toBe(200);
    expect(enabled.body.data.backupCodes).toHaveLength(8);

    const status = await request(app).get('/api/v1/auth/2fa/status').set('Cookie', authCookie());
    expect(status.body.data.enabled).toBe(true);

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', authCookie());
    expect(me.body.data.twoFactorEnabled).toBe(true);
    expect(me.body.data.twoFactorSecret).toBeUndefined();
    expect(me.body.data.twoFactorBackupCodes).toBeUndefined();
  });

  it('requires the second factor at login once enabled', async () => {
    state.user.twoFactorEnabled = true;
    state.user.twoFactorSecret = 'JBSWY3DPEHPK3PXP';
    const app = createTestApp();

    const missing = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: state.user.email, password: 'ValidPass1' });
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('TWO_FACTOR_REQUIRED');

    const valid = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: state.user.email, password: 'ValidPass1', twoFactorCode: currentTotpCode('JBSWY3DPEHPK3PXP') });
    expect(valid.status).toBe(200);
    expect(valid.body.data.user.twoFactorSecret).toBeUndefined();
  });

  it('disables 2FA only with password confirmation', async () => {
    state.user.twoFactorEnabled = true;
    state.user.twoFactorSecret = 'JBSWY3DPEHPK3PXP';
    const app = createTestApp();
    const denied = await request(app).post('/api/v1/auth/2fa/disable').set('Cookie', authCookie()).send({ password: 'WrongPass1' });
    expect(denied.status).toBe(401);
    const done = await request(app).post('/api/v1/auth/2fa/disable').set('Cookie', authCookie()).send({ password: 'ValidPass1' });
    expect(done.status).toBe(200);
    expect(state.user.twoFactorEnabled).toBe(false);
    expect(state.user.twoFactorSecret).toBeNull();
  });
});

describe('account settings — sessions', () => {
  beforeEach(() => {
    state.sessions.clear();
    seedSession(CURRENT_TOKEN, 'session-current');
    seedSession('other-token', 'session-other');
    state.user.twoFactorEnabled = false;
  });

  it('lists sessions with the current one flagged', async () => {
    const response = await request(createTestApp()).get('/api/v1/auth/sessions').set('Cookie', authCookie());
    expect(response.status).toBe(200);
    expect(response.body.data.sessions).toHaveLength(2);
    const current = response.body.data.sessions.find((s: { current: boolean }) => s.current);
    expect(current.id).toBe('session-current');
    expect(response.body.data.sessions[0].tokenHash).toBeUndefined();
  });

  it('revokes another session but refuses the current one', async () => {
    const app = createTestApp();
    const refused = await request(app).delete('/api/v1/auth/sessions/session-current').set('Cookie', authCookie());
    expect(refused.status).toBe(400);
    const revoked = await request(app).delete('/api/v1/auth/sessions/session-other').set('Cookie', authCookie());
    expect(revoked.status).toBe(200);
    const remaining = await request(app).get('/api/v1/auth/sessions').set('Cookie', authCookie());
    expect(remaining.body.data.sessions).toHaveLength(1);
  });

  it('revokes all other sessions at once', async () => {
    const app = createTestApp();
    const response = await request(app).post('/api/v1/auth/sessions/revoke-others').set('Cookie', authCookie());
    expect(response.status).toBe(200);
    expect(response.body.data.revoked).toBe(1);
  });
});

describe('account settings — address book', () => {
  const address = {
    id: 'addr-1',
    label: 'Home',
    street: 'Main Street',
    building: 'Building 12',
    area: 'Al Qasr',
    city: 'Kharga',
    governorate: 'New Valley',
    postalCode: '72511',
    deliveryNotes: 'Call before delivery',
  };

  beforeEach(() => {
    state.sessions.clear();
    seedSession(CURRENT_TOKEN);
    state.user.preferences = null;
  });

  it('rejects unknown governorates and enforces a single default', async () => {
    const app = createTestApp();
    const badGov = await request(app)
      .put('/api/v1/auth/addresses')
      .set('Cookie', authCookie())
      .send({ addresses: [{ ...address, governorate: 'Atlantis' }], defaultAddressId: 'addr-1' });
    expect(badGov.status).toBe(400);

    const badDefault = await request(app)
      .put('/api/v1/auth/addresses')
      .set('Cookie', authCookie())
      .send({ addresses: [address], defaultAddressId: 'addr-missing' });
    expect(badDefault.status).toBe(400);
  });

  it('persists the book and returns it on read', async () => {
    const app = createTestApp();
    const saved = await request(app)
      .put('/api/v1/auth/addresses')
      .set('Cookie', authCookie())
      .send({ addresses: [address], defaultAddressId: 'addr-1' });
    expect(saved.status).toBe(200);
    const read = await request(app).get('/api/v1/auth/addresses').set('Cookie', authCookie());
    expect(read.body.data.addresses).toHaveLength(1);
    expect(read.body.data.defaultAddressId).toBe('addr-1');
    expect(read.body.data.addresses[0].governorate).toBe('New Valley');
  });
});
