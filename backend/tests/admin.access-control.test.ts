import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_NAME } from '../src/auth/session.service';

const state = vi.hoisted(() => {
  const adminUser = {
    id: 'admin-1',
    name: 'CAM Admin',
    email: 'admin@cam-labs.com',
    role: 'ADMIN',
    isAdmin: true,
    accountStatus: 'ACTIVE',
    company: 'CAM LABS',
    phone: null,
    avatar: null,
    tier: 'Admin',
    address: null,
    taxId: null,
    preferences: null,
    passwordHash: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const customerUser = {
    id: 'customer-1',
    name: 'Normal Customer',
    email: 'customer@example.com',
    role: 'CUSTOMER',
    isAdmin: false,
    accountStatus: 'ACTIVE',
    company: 'Independent',
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

  let currentUser = customerUser;

  const prisma = {
    session: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => ({
        id: 'session-1',
        tokenHash: where.tokenHash,
        userId: currentUser.id,
        expiresAt: new Date(Date.now() + 3600_000),
        user: currentUser,
      })),
      create: vi.fn(async () => ({ id: 'session-1' })),
      delete: vi.fn(async () => undefined),
      deleteMany: vi.fn(async () => undefined),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.id === adminUser.id || where.email === adminUser.email) return adminUser;
        if (where.id === customerUser.id || where.email === customerUser.email) return customerUser;
        return null;
      }),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    order: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    quote: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    cadFile: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    manufacturer: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    manufacturingRequest: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    payment: {
      findMany: vi.fn(async () => []),
    },
    auditLog: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    $queryRawUnsafe: vi.fn(async () => [{ ok: 1 }]),
    systemSetting: {
      findUnique: vi.fn(async () => ({ key: 'adminUrl', value: '/admin' })),
      findMany: vi.fn(async () => []),
    },
  };

  return { adminUser, customerUser, getCurrentUser: () => currentUser, setCurrentUser: (u: any) => { currentUser = u; }, prisma };
});

vi.mock('../src/config/database', () => ({ getPrismaClient: () => state.prisma }));

import authRoutes from '../src/routes/auth.routes';
import adminRoutes from '../src/routes/admin.routes';
import adminSettingsRoutes from '../src/routes/admin-settings.routes';
import { errorHandler } from '../src/middleware/error.middleware';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/admin/settings', adminSettingsRoutes);
  app.use(errorHandler);
  return app;
};

describe('Admin Panel Access Control & Role Consistency', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('Role Consistency Check (/auth/me)', () => {
    it('returns role: ADMIN for authenticated Admin accounts', async () => {
      state.setCurrentUser(state.adminUser);
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('ADMIN');
      expect(res.body.data.email).toBe('admin@cam-labs.com');
    });

    it('returns role: CUSTOMER for authenticated Customer accounts', async () => {
      state.setCurrentUser(state.customerUser);
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('CUSTOMER');
      expect(res.body.data.email).toBe('customer@example.com');
    });

    it('preserves specialized admin roles (e.g. SUPER_ADMIN, OPERATIONS_ADMIN)', async () => {
      for (const specializedRole of ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'PRICING_ADMIN']) {
        state.setCurrentUser({ ...state.adminUser, role: specializedRole });
        const res = await request(app)
          .get('/api/v1/auth/me')
          .set('Cookie', `${SESSION_COOKIE_NAME}=tok`);

        expect(res.status).toBe(200);
        expect(res.body.data.role).toBe(specializedRole);
      }
    });

    it('rejects unauthenticated requests to /auth/me with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('Server-side Admin API Endpoint Authorization', () => {
    it('rejects unauthenticated requests to /api/v1/admin/dashboard with 401', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects Customer accounts from /api/v1/admin/dashboard with 403 Forbidden', async () => {
      state.setCurrentUser(state.customerUser);
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows Admin accounts to access /api/v1/admin/dashboard', async () => {
      state.setCurrentUser(state.adminUser);
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('protects /api/v1/admin/settings/admin-url: rejects unauthenticated with 401', async () => {
      const res = await request(app).get('/api/v1/admin/settings/admin-url');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('protects /api/v1/admin/settings/admin-url: rejects Customer accounts with 403', async () => {
      state.setCurrentUser(state.customerUser);
      const res = await request(app)
        .get('/api/v1/admin/settings/admin-url')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('protects /api/v1/admin/settings/admin-url: allows Admin accounts with 200', async () => {
      state.setCurrentUser(state.adminUser);
      const res = await request(app)
        .get('/api/v1/admin/settings/admin-url')
        .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`);

      expect(res.status).toBe(200);
      expect(res.body.data.adminUrl).toBe('/admin');
    });

    it('rejects Customer accounts from /api/v1/admin/orders with 403 Forbidden', async () => {
      state.setCurrentUser(state.customerUser);
      const res = await request(app)
        .get('/api/v1/admin/orders')
        .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
