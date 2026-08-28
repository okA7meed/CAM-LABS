import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_NAME } from '../src/auth/session.service';

const state = vi.hoisted(() => {
  const user = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'CUSTOMER',
    accountStatus: 'ACTIVE',
    company: null,
    phone: null,
    avatar: null,
    tier: null,
    address: null,
    taxId: null,
    preferences: null,
    passwordHash: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const prisma = {
    session: {
      findUnique: vi.fn(async () => ({
        id: 'session-1',
        tokenHash: 'hash',
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600_000),
        user,
      })),
      create: vi.fn(async () => ({ id: 'session-1' })),
      delete: vi.fn(async () => undefined),
      deleteMany: vi.fn(async () => undefined),
    },
    user: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => user),
      update: vi.fn(async () => user),
    },
  };
  return { user, prisma };
});

vi.mock('../src/config/database', () => ({ getPrismaClient: () => state.prisma }));

import {
  requireAdmin,
  requirePricingAdmin,
  requireAnyAdmin,
} from '../src/middleware/admin.middleware';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.get('/admin/any', requireAnyAdmin, (_req, res) => res.sendStatus(204));
  app.get('/admin/basic', requireAdmin, (_req, res) => res.sendStatus(204));
  app.get('/admin/pricing', requirePricingAdmin, (_req, res) => res.sendStatus(204));
  return app;
};

describe('Admin authorization guards', () => {
  let app: express.Express;

  beforeEach(() => {
    state.user.role = 'CUSTOMER';
    app = createTestApp();
  });

  it('rejects unauthenticated requests with 401 for every admin guard', async () => {
    expect((await request(app).get('/admin/pricing')).status).toBe(401);
    expect((await request(app).get('/admin/any')).status).toBe(401);
    expect((await request(app).get('/admin/basic')).status).toBe(401);
  });

  it('requireAdmin now enforces real admin access: CUSTOMER is denied 403', async () => {
    state.user.role = 'CUSTOMER';
    const res = await request(app).get('/admin/basic').set('Cookie', `${SESSION_COOKIE_NAME}=tok`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it.each([
    ['CUSTOMER', 403],
    ['MAKER', 403],
    ['ENGINEER', 403],
  ])('denies %s on any-admin guard with 403', async (role, expected) => {
    state.user.role = role as string;
    const res = await request(app).get('/admin/basic').set('Cookie', `${SESSION_COOKIE_NAME}=tok`);
    expect(res.status).toBe(expected);
  });

  it.each([
    ['SUPPORT_ADMIN', 204],
    ['FINANCE_ADMIN', 204],
    ['PRICING_ADMIN', 204],
    ['OPERATIONS_ADMIN', 204],
    ['ADMIN', 204],
    ['SUPER_ADMIN', 204],
  ])('allows %s on any-admin guard with 204', async (role, expected) => {
    state.user.role = role as string;
    const res = await request(app).get('/admin/basic').set('Cookie', `${SESSION_COOKIE_NAME}=tok`);
    expect(res.status).toBe(expected);
  });

  it.each([
    ['CUSTOMER', 403],
    ['MAKER', 403],
    ['ENGINEER', 403],
    ['SUPPORT_ADMIN', 403],
    ['FINANCE_ADMIN', 403],
  ])('denies %s on pricing-admin with 403', async (role, expected) => {
    state.user.role = role as string;
    const res = await request(app).get('/admin/pricing').set('Cookie', `${SESSION_COOKIE_NAME}=tok`);
    expect(res.status).toBe(expected);
  });

  it.each([
    ['PRICING_ADMIN', 204],
    ['OPERATIONS_ADMIN', 204],
    ['ADMIN', 204],
    ['SUPER_ADMIN', 204],
  ])('allows %s on pricing-admin with 204', async (role, expected) => {
    state.user.role = role as string;
    const res = await request(app).get('/admin/pricing').set('Cookie', `${SESSION_COOKIE_NAME}=tok`);
    expect(res.status).toBe(expected);
  });

  it('returns a structured 401 body on unauthenticated admin requests', async () => {
    const res = await request(app).get('/admin/pricing');
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns a structured 403 body for authenticated non-admin users', async () => {
    const res = await request(app).get('/admin/pricing').set('Cookie', `${SESSION_COOKIE_NAME}=tok`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});