import express from 'express';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Account growth pass: country-aware phone validation, verified email
 * change, and customer quote deletion requests (deletion-by-approval).
 */

const sentCodes: string[] = [];

vi.mock('../src/services/email.service', () => ({
  EmailService: {
    sendPasswordResetCode: vi.fn(async () => ({ id: 'test' })),
    sendVerificationCode: vi.fn(async (_to: string, code: string) => {
      sentCodes.push(code);
      return { id: 'test' };
    }),
  },
}));

const state = vi.hoisted(() => {
  const users = new Map<string, any>();
  const challenges: any[] = [];
  const quotes = new Map<string, any>();
  const sessions = new Map<string, any>();
  const deletionRequests = new Map<string, any>();
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id) return users.has(where.id) ? { ...users.get(where.id) } : null;
        if (where.email) {
          for (const u of users.values()) if (u.email === where.email) return { ...u };
          return null;
        }
        if (where.googleSub !== undefined) {
          for (const u of users.values()) if (u.googleSub === where.googleSub) return { ...u };
          return null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const user = { id: `user-${users.size + 1}`, ...data };
        users.set(user.id, user);
        return { ...user };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const user = users.get(where.id);
        if (!user) {
          const err: any = new Error('not found');
          err.code = 'P2025';
          throw err;
        }
        if (data.email) {
          for (const u of users.values()) {
            if (u.id !== where.id && u.email === data.email) {
              const err: any = new Error('unique');
              err.code = 'P2002';
              throw err;
            }
          }
        }
        Object.assign(user, data);
        return { ...user };
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const user = users.get(where.id);
        if (!user) return { count: 0 };
        if (data.email) {
          for (const u of users.values()) {
            if (u.id !== where.id && u.email === data.email) {
              const err: any = new Error('unique');
              err.code = 'P2002';
              throw err;
            }
          }
        }
        Object.assign(user, data);
        return { count: 1 };
      }),
    },
    emailChangeChallenge: {
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        const list = challenges.filter((c) => {
          if (where.userId && c.userId !== where.userId) return false;
          if (where.usedAt === null && c.usedAt !== null) return false;
          if (where.usedAt && typeof where.usedAt === 'object') return true;
          if (where.createdAt?.gt && !(c.createdAt > where.createdAt.gt)) return false;
          if (where.expiresAt?.lt && !(c.expiresAt < where.expiresAt.lt)) return false;
          return true;
        });
        list.sort((a, b) => (orderBy?.createdAt === 'desc' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
        return list[0] ? { ...list[0] } : null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const c = { id: `chg-${challenges.length + 1}`, attempts: 0, usedAt: null, createdAt: new Date(), ...data };
        challenges.push(c);
        return { ...c };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const c = challenges.find((x) => x.id === where.id);
        if (!c) throw new Error('not found');
        const apply = (v: any) => {
          if (v && typeof v === 'object' && 'increment' in v) return (c.attempts || 0) + v.increment;
          return v;
        };
        for (const k of Object.keys(data)) (c as any)[k] = k === 'attempts' ? apply(data[k]) : data[k];
        return { ...c };
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const c of challenges) {
          if (where.userId && c.userId !== where.userId) continue;
          if (where.id && typeof where.id === 'string' && c.id !== where.id) continue;
          if (where.id && typeof where.id === 'object' && where.id.not && c.id === where.id.not) continue;
          if (where.usedAt === null && c.usedAt !== null) continue;
          if (where.usedAt && typeof where.usedAt === 'object' && where.usedAt.not !== undefined && c.usedAt === where.usedAt.not) continue;
          Object.assign(c, data);
          count += 1;
        }
        return { count };
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        let count = 0;
        for (let i = challenges.length - 1; i >= 0; i--) {
          const c = challenges[i];
          if (where.userId && c.userId !== where.userId) continue;
          let drop = false;
          for (const cond of where.OR || []) {
            if (cond.usedAt && cond.usedAt.not !== undefined && c.usedAt !== cond.usedAt.not) drop = true;
            if (cond.usedAt && cond.usedAt.not === null && c.usedAt !== null) drop = true;
            if (cond.expiresAt?.lt && c.expiresAt < cond.expiresAt.lt) drop = true;
          }
          if (drop) {
            challenges.splice(i, 1);
            count += 1;
          }
        }
        return { count };
      }),
    },
    quote: {
      findUnique: vi.fn(async ({ where }: any) => (quotes.has(where.id) ? { ...quotes.get(where.id) } : null)),
      delete: vi.fn(async ({ where }: any) => {
        const q = quotes.get(where.id);
        if (!q) {
          const err: any = new Error('not found');
          err.code = 'P2025';
          throw err;
        }
        quotes.delete(where.id);
        return q;
      }),
    },
    quoteDeletionRequest: {
      findFirst: vi.fn(async ({ where }: any) => {
        for (const r of deletionRequests.values()) {
          if (where.quoteId && r.quoteId !== where.quoteId) continue;
          if (where.status && r.status !== where.status) continue;
          return { ...r };
        }
        return null;
      }),
      findMany: vi.fn(async ({ where }: any = {}) => {
        const out: any[] = [];
        for (const r of deletionRequests.values()) {
          if (where.quoteId && r.quoteId !== where.quoteId) continue;
          if (where.status && r.status !== where.status) continue;
          out.push({ ...r });
        }
        return out;
      }),
      findUnique: vi.fn(async ({ where }: any) => (deletionRequests.has(where.id) ? { ...deletionRequests.get(where.id) } : null)),
      create: vi.fn(async ({ data }: any) => {
        for (const r of deletionRequests.values()) {
          if (r.quoteId === data.quoteId && r.status === 'PENDING') {
            const err: any = new Error('unique');
            err.code = 'P2002';
            throw err;
          }
        }
        const r = { id: `delreq-${deletionRequests.size + 1}`, requestedAt: new Date(), ...data };
        deletionRequests.set(r.id, r);
        return { ...r };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = deletionRequests.get(where.id);
        if (!r) {
          const err: any = new Error('not found');
          err.code = 'P2025';
          throw err;
        }
        Object.assign(r, data);
        return { ...r };
      }),
    },
    session: {
      create: vi.fn(async ({ data }: any) => {
        const session = { id: `session-${sessions.size + 1}`, createdAt: new Date(), ...data };
        sessions.set(data.tokenHash, session);
        return session;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const session = sessions.get(where.tokenHash);
        if (!session) return null;
        const user = users.get(session.userId);
        return user ? { ...session, user: { ...user } } : null;
      }),
      findMany: vi.fn(async () => [...sessions.values()]),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (fn: any) => {
      const tx = {
        emailChangeChallenge: {
          updateMany: async ({ where, data }: any) => prisma.emailChangeChallenge.updateMany({ where, data }),
        },
        user: {
          updateMany: async ({ where, data }: any) => prisma.user.updateMany({ where, data }),
          findUnique: async ({ where }: any) => prisma.user.findUnique({ where }),
        },
      };
      return fn(tx);
    }),
    auditLog: { create: vi.fn(async () => ({ id: 'log-1' })) },
  };
  return { users, challenges, quotes, sessions, deletionRequests, prisma };
});

vi.mock('../src/config/database', () => ({ getPrismaClient: () => state.prisma }));

import authRoutes from '../src/routes/auth.routes';
import quoteRoutes from '../src/routes/quotes.routes';
import { errorHandler } from '../src/middleware/error.middleware';
import { hashPassword } from '../src/auth/password.service';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/quotes', quoteRoutes);
  app.use(errorHandler);
  return app;
};

const seedUser = (overrides: any = {}) => {
  const user = {
    id: `user-${state.users.size + 1}`,
    name: 'Test Engineer',
    email: `test${state.users.size + 1}@example.com`,
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
    googleSub: null,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: [],
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
  state.users.set(user.id, user);
  return user;
};

const seedSession = (userId: string, token: string) => {
  state.sessions.set(hashToken(token), {
    id: `session-${token}`,
    userId,
    tokenHash: hashToken(token),
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
    expiresAt: new Date(Date.now() + 3600_000),
    createdAt: new Date(),
  });
};

beforeEach(() => {
  state.users.clear();
  state.challenges.length = 0;
  state.quotes.clear();
  state.sessions.clear();
  state.deletionRequests.clear();
  sentCodes.length = 0;
});

describe('country-aware phone validation', () => {
  it('rejects impossible numbers at registration with UX-safe codes', async () => {
    const short = await request(createTestApp()).post('/api/v1/auth/register').send({
      name: 'New User',
      email: 'phone1@example.com',
      password: 'ValidPass1',
      phone: '123',
    });
    expect(short.status).toBe(400);
    expect(['PHONE_INVALID', 'PHONE_TOO_SHORT', 'PHONE_TOO_LONG']).toContain(short.body.error.code);

    const badPrefix = await request(createTestApp()).post('/api/v1/auth/register').send({
      name: 'New User',
      email: 'phone2@example.com',
      password: 'ValidPass1',
      phone: '2123456789',
    });
    expect(badPrefix.status).toBe(400);
    expect(badPrefix.body.error.code).toBe('PHONE_INVALID');
  });

  it('normalizes Egyptian national numbers to E.164', async () => {
    const response = await request(createTestApp()).post('/api/v1/auth/register').send({
      name: 'New User',
      email: 'phone3@example.com',
      password: 'ValidPass1',
      phone: '1012345678',
    });
    expect(response.status).toBe(201);
    expect(response.body.data.user.phone).toBe('+201012345678');
  });
});

describe('verified email change', () => {
  it('requests with password, verifies the OTP, and swaps the login email', async () => {
    const user = seedUser({ passwordHash: await hashPassword('ValidPass1') });
    seedSession(user.id, 'email-token');
    const app = createTestApp();

    const req = await request(app)
      .post('/api/v1/auth/email/change-request')
      .set('Cookie', 'cam_labs_session=email-token')
      .send({ newEmail: 'new-address@example.com', password: 'ValidPass1' });
    expect(req.status).toBe(200);
    expect(req.body.data.obfuscatedEmail).toContain('@example.com');
    expect(req.body.data.obfuscatedEmail).not.toContain('new-address');
    expect(sentCodes).toHaveLength(1);

    const wrong = await request(app)
      .post('/api/v1/auth/email/change-verify')
      .set('Cookie', 'cam_labs_session=email-token')
      .send({ code: '000000' });
    expect(wrong.status).toBe(401);

    const done = await request(app)
      .post('/api/v1/auth/email/change-verify')
      .set('Cookie', 'cam_labs_session=email-token')
      .send({ code: sentCodes[0] });
    expect(done.status).toBe(200);
    expect(done.body.data.user.email).toBe('new-address@example.com');
    expect(state.users.get(user.id).email).toBe('new-address@example.com');
  });

  it('rejects duplicate addresses and wrong passwords', async () => {
    const other = seedUser({ email: 'taken@example.com', passwordHash: await hashPassword('ValidPass1') });
    const user = seedUser({ email: 'me@example.com', passwordHash: await hashPassword('ValidPass1') });
    seedSession(user.id, 'email-token-2');
    void other;
    const app = createTestApp();

    const taken = await request(app)
      .post('/api/v1/auth/email/change-request')
      .set('Cookie', 'cam_labs_session=email-token-2')
      .send({ newEmail: 'taken@example.com', password: 'ValidPass1' });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('EMAIL_TAKEN');

    const wrongPw = await request(app)
      .post('/api/v1/auth/email/change-request')
      .set('Cookie', 'cam_labs_session=email-token-2')
      .send({ newEmail: 'fresh@example.com', password: 'WrongPass1' });
    expect(wrongPw.status).toBe(401);
    expect(wrongPw.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
  });
});

describe('customer quote deletion requests (deletion-by-approval)', () => {
  const seedQuote = (userId: string, overrides: any = {}) => {
    const quote = {
      id: `quote-${state.quotes.size + 1}`,
      userId,
      partName: 'Bracket',
      status: 'Ready for Approval',
      convertedOrderId: null,
      reference: 'CAM-2026-000001',
      ...overrides,
    };
    state.quotes.set(quote.id, quote);
    return quote;
  };

  it('files a deletion request without deleting the quote', async () => {
    const user = seedUser();
    seedSession(user.id, 'quote-token');
    const quote = seedQuote(user.id);
    const response = await request(createTestApp())
      .post(`/api/v1/quotes/${quote.id}/deletion-request`)
      .set('Cookie', 'cam_labs_session=quote-token')
      .send({ reason: 'Ordered by mistake' });
    expect(response.status).toBe(201);
    expect(response.body.data.quoteId).toBe(quote.id);
    expect(response.body.data.status).toBe('PENDING');
    // The quote stays visible while the request is pending.
    expect(state.quotes.has(quote.id)).toBe(true);
  });

  it('reuses the pending request instead of duplicating it', async () => {
    const user = seedUser();
    seedSession(user.id, 'quote-token-dup');
    const quote = seedQuote(user.id);
    const app = createTestApp();
    const first = await request(app)
      .post(`/api/v1/quotes/${quote.id}/deletion-request`)
      .set('Cookie', 'cam_labs_session=quote-token-dup')
      .send({});
    const second = await request(app)
      .post(`/api/v1/quotes/${quote.id}/deletion-request`)
      .set('Cookie', 'cam_labs_session=quote-token-dup')
      .send({});
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(state.deletionRequests.size).toBe(1);
  });

  it('returns 404 for foreign quotes (no id oracle)', async () => {
    const owner = seedUser({ email: 'owner@example.com' });
    const intruder = seedUser({ email: 'intruder@example.com' });
    seedSession(intruder.id, 'intruder-token');
    const quote = seedQuote(owner.id);
    const response = await request(createTestApp())
      .post(`/api/v1/quotes/${quote.id}/deletion-request`)
      .set('Cookie', 'cam_labs_session=intruder-token')
      .send({});
    expect(response.status).toBe(404);
    expect(state.deletionRequests.size).toBe(0);
  });

  it('protects converted and approved quotes', async () => {
    const user = seedUser();
    seedSession(user.id, 'protected-token');
    const app = createTestApp();
    const converted = seedQuote(user.id, { status: 'Approved', convertedOrderId: 'order-1' });
    const approved = seedQuote(user.id, { status: 'Approved', convertedOrderId: null });

    for (const q of [converted, approved]) {
      const response = await request(app)
        .post(`/api/v1/quotes/${q.id}/deletion-request`)
        .set('Cookie', 'cam_labs_session=protected-token')
        .send({});
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('QUOTE_PROTECTED');
      expect(state.quotes.has(q.id)).toBe(true);
    }
    expect(state.deletionRequests.size).toBe(0);
  });

  it('direct DELETE is disabled (410) and never removes the quote', async () => {
    const user = seedUser();
    seedSession(user.id, 'nodelete-token');
    const quote = seedQuote(user.id);
    const response = await request(createTestApp())
      .delete(`/api/v1/quotes/${quote.id}`)
      .set('Cookie', 'cam_labs_session=nodelete-token');
    expect(response.status).toBe(410);
    expect(response.body.error.code).toBe('QUOTE_DELETE_DISABLED');
    expect(state.quotes.has(quote.id)).toBe(true);
  });
});
