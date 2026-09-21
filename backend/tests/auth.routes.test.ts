import express from 'express';
import request from 'supertest';
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
    preferences: null,
    passwordHash: '',
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const sessions = new Map<string, { id: string; userId: string; expiresAt: Date }>();
  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email === user.email || where.id === user.id) return user;
        return null;
      }),
      create: vi.fn(async ({ data }: { data: typeof user }) => ({ ...user, ...data })),
      update: vi.fn(async ({ data }: { data: Partial<typeof user> }) => ({ ...user, ...data })),
    },
    session: {
      create: vi.fn(async ({ data }: { data: { tokenHash: string; userId: string; expiresAt: Date } }) => {
        const session = { id: `session-${sessions.size + 1}`, ...data };
        sessions.set(data.tokenHash, session);
        return session;
      }),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.get(where.tokenHash);
        return session ? { ...session, user } : null;
      }),
      delete: vi.fn(async () => undefined),
      deleteMany: vi.fn(async () => {
        sessions.clear();
        return undefined;
      }),
    },
    auditLog: {
      create: vi.fn(async () => ({ id: 'log-1' })),
    },
  };
  return { user, sessions, prisma };
});

vi.mock('../src/config/database', () => ({ getPrismaClient: () => state.prisma }));

import authRoutes from '../src/routes/auth.routes';
import { errorHandler } from '../src/middleware/error.middleware';
import { requireOwnerOrRole, requireRoles } from '../src/middleware/authorization.middleware';
import { hashPassword, verifyPassword } from '../src/auth/password.service';
import { hasRole } from '../src/auth/roles';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.get('/role/customer', (req, res, next) => {
    req.auth = { ...state.user, role: 'CUSTOMER', sessionId: 's' };
    requireRoles('CUSTOMER')(req, res, next);
  }, (_req, res) => res.sendStatus(204));
  app.get('/role/admin', (req, res, next) => {
    req.auth = { ...state.user, role: 'CUSTOMER', sessionId: 's' };
    requireRoles('ADMIN')(req, res, next);
  }, (_req, res) => res.sendStatus(204));
  app.get('/owner/:id', (req, res, next) => {
    req.auth = { ...state.user, sessionId: 's' };
    requireOwnerOrRole(() => req.params.id, 'ADMIN')(req, res, next);
  }, (_req, res) => res.sendStatus(204));
  app.get('/owner-admin/:id', (req, res, next) => {
    req.auth = { ...state.user, role: 'ADMIN', sessionId: 's' };
    requireOwnerOrRole(() => req.params.id, 'ADMIN')(req, res, next);
  }, (_req, res) => res.sendStatus(204));
  app.use(errorHandler);
  return app;
};

describe('authentication foundation', () => {
  beforeEach(async () => {
    state.prisma.user.findUnique.mockClear();
    state.prisma.user.create.mockClear();
    state.prisma.session.create.mockClear();
    state.prisma.session.findUnique.mockClear();
    state.prisma.session.deleteMany.mockClear();
    state.sessions.clear();
    state.user.passwordHash = await hashPassword('ValidPass1');
    state.user.role = 'CUSTOMER';
    state.user.isAdmin = false;
    state.user.accountStatus = 'ACTIVE';
  });

  it('hashes passwords and never returns the hash during registration', async () => {
    const response = await request(createTestApp()).post('/api/v1/auth/register').send({
      name: 'New User',
      email: 'new@example.com',
      password: 'ValidPass1',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(state.prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: 'CUSTOMER' }),
    }));
  });

  it('rejects malformed and weak registration payloads', async () => {
    const malformed = await request(createTestApp()).post('/api/v1/auth/register').send({ email: 'bad' });
    const weak = await request(createTestApp()).post('/api/v1/auth/register').send({
      name: 'New User', email: 'new@example.com', password: 'weakpass',
    });
    expect(malformed.status).toBe(400);
    expect(weak.status).toBe(400);
  });

  it('rejects duplicate accounts without exposing persistence details', async () => {
    const response = await request(createTestApp()).post('/api/v1/auth/register').send({
      name: 'Existing User', email: state.user.email, password: 'ValidPass1',
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ACCOUNT_EXISTS');
  });

  it('verifies valid credentials and rejects invalid credentials', async () => {
    const valid = await request(createTestApp()).post('/api/v1/auth/login').send({ email: state.user.email, password: 'ValidPass1' });
    const invalid = await request(createTestApp()).post('/api/v1/auth/login').send({ email: state.user.email, password: 'WrongPass1' });
    expect(valid.status).toBe(200);
    expect(valid.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(valid.body.data.user.passwordHash).toBeUndefined();
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects unknown emails exactly like wrong passwords (no enumeration oracle)', async () => {
    const response = await request(createTestApp()).post('/api/v1/auth/login').send({ email: 'ghost@example.com', password: 'ValidPass1' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(response.body.error.message).toBe('Invalid email or password.');
  });

  it('rejects malformed login payloads without touching persistence', async () => {
    const response = await request(createTestApp()).post('/api/v1/auth/login').send({ email: 'not-an-email' });
    expect(response.status).toBe(400);
    expect(state.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('honors Remember Me: long session by default, short session when unchecked', async () => {
    const app = createTestApp();
    const HOUR_MS = 60 * 60 * 1000;
    // NOTE: .env.test sets SESSION_TTL_DAYS=1, so the "long" policy here is
    // ~24h and the short policy (~12h) stays distinguishable in every env.

    await request(app).post('/api/v1/auth/login').send({ email: state.user.email, password: 'ValidPass1' });
    const longCall = state.prisma.session.create.mock.calls.at(-1)?.[0];
    const longDelta = new Date(longCall.data.expiresAt).getTime() - Date.now();
    expect(longDelta).toBeGreaterThan(20 * HOUR_MS);

    await request(app).post('/api/v1/auth/login').send({ email: state.user.email, password: 'ValidPass1', rememberMe: true });
    const explicitLongCall = state.prisma.session.create.mock.calls.at(-1)?.[0];
    const explicitLongDelta = new Date(explicitLongCall.data.expiresAt).getTime() - Date.now();
    expect(explicitLongDelta).toBeGreaterThan(20 * HOUR_MS);

    await request(app).post('/api/v1/auth/login').send({ email: state.user.email, password: 'ValidPass1', rememberMe: false });
    const shortCall = state.prisma.session.create.mock.calls.at(-1)?.[0];
    const shortDelta = new Date(shortCall.data.expiresAt).getTime() - Date.now();
    expect(shortDelta).toBeGreaterThan(10 * HOUR_MS);
    expect(shortDelta).toBeLessThan(14 * HOUR_MS);
    expect(shortDelta).toBeLessThan(longDelta);
  });

  it('lets admin accounts log in through the SAME single login endpoint and keeps their admin role', async () => {
    state.user.role = 'ADMIN';
    state.user.isAdmin = true;
    state.user.accountStatus = 'ACTIVE';

    const response = await request(createTestApp()).post('/api/v1/auth/login').send({ email: state.user.email, password: 'ValidPass1' });

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.body.data.user.role).toBe('ADMIN');
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.token).toBeUndefined();
    expect(state.prisma.session.create).toHaveBeenCalled();
  });

  it('verifies password hashes independently of plaintext values', async () => {
    const hash = await hashPassword('ValidPass1');
    expect(hash).not.toBe('ValidPass1');
    expect(await verifyPassword('ValidPass1', hash)).toBe(true);
    expect(await verifyPassword('WrongPass1', hash)).toBe(false);
  });

  it('rejects unauthenticated identity requests', async () => {
    const response = await request(createTestApp()).get('/api/v1/auth/me');
    expect(response.status).toBe(401);
  });

  it('resolves /me from the session and invalidates it on logout', async () => {
    const agent = request.agent(createTestApp());
    const login = await agent.post('/api/v1/auth/login').send({ email: state.user.email, password: 'ValidPass1' });
    const authenticated = await agent.get('/api/v1/auth/me');
    const loggedOut = await agent.post('/api/v1/auth/logout');
    const afterLogout = await agent.get('/api/v1/auth/me');

    expect(login.status).toBe(200);
    expect(authenticated.status).toBe(200);
    expect(authenticated.body.data.passwordHash).toBeUndefined();
    expect(loggedOut.status).toBe(200);
    expect(afterLogout.status).toBe(401);
  });

  it('supports logout and clears the session cookie', async () => {
    const response = await request(createTestApp()).post('/api/v1/auth/logout');
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).toContain('Max-Age=0');
    expect(state.prisma.session.deleteMany).not.toHaveBeenCalled();
  });

  it('exposes exactly one login system: there is no separate admin login endpoint', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/auth/admin/login')
      .send({ email: state.user.email, password: 'ValidAdminPass1!' });

    expect(response.status).toBe(404);
  });

  it('centralizes role and ownership decisions', async () => {
    expect((await request(createTestApp()).get('/role/customer')).status).toBe(204);
    expect((await request(createTestApp()).get('/role/admin')).status).toBe(403);
    expect((await request(createTestApp()).get('/owner/user-1')).status).toBe(204);
    expect((await request(createTestApp()).get('/owner/other-user')).status).toBe(403);
    expect((await request(createTestApp()).get('/owner-admin/other-user')).status).toBe(204);
    expect(hasRole('CUSTOMER', ['CUSTOMER'])).toBe(true);
    expect(hasRole('MAKER', ['MAKER'])).toBe(true);
    expect(hasRole('ENGINEER', ['ENGINEER'])).toBe(true);
    expect(hasRole('ADMIN', ['ADMIN'])).toBe(true);
    expect(hasRole('SUPER_ADMIN', ['SUPER_ADMIN'])).toBe(true);
  });

  describe('Google Identity Services sign-in (POST /auth/google)', () => {
    const googleModule = () => import('../src/config/env').then((m) => m.ENV);
    const validCredential = 'google-id-token-credential-value';

    const stubTokeninfo = (body: Record<string, unknown>, ok = true) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          ok
            ? { ok: true, json: async () => body }
            : { ok: false, json: async () => ({ error: 'invalid_token' }) },
        ),
      );
    };

    it('rejects Google sign-in with 501 when no client ID is configured', async () => {
      const ENV = await googleModule();
      const previous = ENV.GOOGLE_CLIENT_ID;
      ENV.GOOGLE_CLIENT_ID = '';
      try {
        const response = await request(createTestApp())
          .post('/api/v1/auth/google')
          .send({ credential: validCredential });
        expect(response.status).toBe(501);
        expect(response.body.error.code).toBe('GOOGLE_NOT_CONFIGURED');
      } finally {
        ENV.GOOGLE_CLIENT_ID = previous;
        vi.unstubAllGlobals();
      }
    });

    it('rejects malformed Google requests without contacting Google', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      try {
        const response = await request(createTestApp()).post('/api/v1/auth/google').send({});
        expect(response.status).toBe(400);
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('authenticates the existing account for a verified Google identity (no duplicate user)', async () => {
      const ENV = await googleModule();
      const previous = ENV.GOOGLE_CLIENT_ID;
      ENV.GOOGLE_CLIENT_ID = 'test-google-client-id';
      state.prisma.user.create.mockClear();
      stubTokeninfo({
        aud: 'test-google-client-id',
        exp: String(Math.floor(Date.now() / 1000) + 3600),
        email: state.user.email,
        email_verified: 'true',
        sub: 'google-sub-123',
        name: 'Test Engineer',
      });
      try {
        const response = await request(createTestApp())
          .post('/api/v1/auth/google')
          .send({ credential: validCredential });
        expect(response.status).toBe(200);
        expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
        expect(response.body.data.user.passwordHash).toBeUndefined();
        expect(state.prisma.user.create).not.toHaveBeenCalled();
      } finally {
        ENV.GOOGLE_CLIENT_ID = previous;
        vi.unstubAllGlobals();
      }
    });

    it('creates a customer account for a new Google identity without fabricating profile fields', async () => {
      const ENV = await googleModule();
      const previous = ENV.GOOGLE_CLIENT_ID;
      ENV.GOOGLE_CLIENT_ID = 'test-google-client-id';
      state.prisma.user.create.mockClear();
      stubTokeninfo({
        aud: 'test-google-client-id',
        exp: String(Math.floor(Date.now() / 1000) + 3600),
        email: 'new-google-user@example.com',
        email_verified: 'true',
        sub: 'google-sub-456',
        name: 'Google Engineer',
      });
      try {
        const response = await request(createTestApp())
          .post('/api/v1/auth/google')
          .send({ credential: validCredential });
        expect(response.status).toBe(201);
        expect(state.prisma.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              email: 'new-google-user@example.com',
              company: 'Independent',
              phone: null,
              passwordHash: null,
              role: 'CUSTOMER',
            }),
          }),
        );
      } finally {
        ENV.GOOGLE_CLIENT_ID = previous;
        vi.unstubAllGlobals();
      }
    });

    it('rejects Google tokens issued for a different audience', async () => {
      const ENV = await googleModule();
      const previous = ENV.GOOGLE_CLIENT_ID;
      ENV.GOOGLE_CLIENT_ID = 'test-google-client-id';
      stubTokeninfo({
        aud: 'some-other-client',
        exp: String(Math.floor(Date.now() / 1000) + 3600),
        email: 'attacker@example.com',
        email_verified: 'true',
        sub: 'google-sub-789',
      });
      try {
        const response = await request(createTestApp())
          .post('/api/v1/auth/google')
          .send({ credential: validCredential });
        expect(response.status).toBe(401);
      } finally {
        ENV.GOOGLE_CLIENT_ID = previous;
        vi.unstubAllGlobals();
      }
    });
  });
});
