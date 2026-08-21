import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const user = {
    id: 'user-1',
    name: 'Test Engineer',
    email: 'test@example.com',
    role: 'CUSTOMER',
    accountStatus: 'ACTIVE',
    company: 'Test Co',
    phone: null,
    avatar: null,
    tier: 'Pro Engineer',
    address: null,
    taxId: null,
    preferences: null,
    passwordHash: '',
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
});
