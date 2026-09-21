import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_NAME } from '../src/auth/session.service';

const state = vi.hoisted(() => {
  const adminUser = {
    id: 'admin-1',
    name: 'CAM Admin',
    email: 'admin@cam-labs.com',
    role: 'OPERATIONS_ADMIN',
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

  let currentUser: typeof customerUser = customerUser;

  const quoteRecord = {
    id: 'RFQ-2026-111111',
    userId: 'customer-1',
    status: 'Ready for Approval',
    quantity: 2,
    totalPrice: '200.00 EGP',
    unitPrice: '100.00 EGP',
    technicalNotes: '',
    convertedOrderId: null,
    systemTotalPrice: null,
    user: { id: 'customer-1', email: 'customer@example.com' },
  };

  const prisma = {
    session: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => ({
        id: 'session-1',
        tokenHash: where.tokenHash,
        userId: currentUser.id,
        expiresAt: new Date(Date.now() + 3600_000),
        user: currentUser,
      })),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.id === adminUser.id || where.email === adminUser.email) return adminUser;
        if (where.id === customerUser.id || where.email === customerUser.email) return customerUser;
        return null;
      }),
    },
    quote: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === quoteRecord.id ? { ...quoteRecord } : null,
      ),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...quoteRecord, ...data })),
    },
    quoteMessage: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'qmsg-1',
        createdAt: new Date('2026-09-15T12:00:00.000Z'),
        ...data,
      })),
      findMany: vi.fn(async () => []),
    },
    auditLog: {
      create: vi.fn(async () => ({ id: 'audit-1' })),
    },
  };

  return { adminUser, customerUser, getCurrentUser: () => currentUser, setCurrentUser: (u: typeof customerUser) => { currentUser = u; }, prisma, quoteRecord };
});

vi.mock('../src/config/database', () => ({ getPrismaClient: () => state.prisma }));

import adminRoutes from '../src/routes/admin.routes';
import { errorHandler } from '../src/middleware/error.middleware';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRoutes);
  app.use(errorHandler);
  return app;
};

describe('Admin quote lifecycle (status / price / notes / message)', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  it('updates quote status and audit-logs the transition', async () => {
    state.setCurrentUser(state.adminUser);
    const res = await request(app)
      .put('/api/v1/admin/quotes/RFQ-2026-111111/status')
      .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`)
      .send({ status: 'Revised', reason: 'Needs geometry fix' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(state.prisma.quote.update).toHaveBeenCalledOnce();
    const payload = state.prisma.quote.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(payload.data.status).toBe('Revised');
    expect(state.prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it('requires a reason for rejection and rejects unknown statuses', async () => {
    state.setCurrentUser(state.adminUser);
    const missing = await request(app)
      .put('/api/v1/admin/quotes/RFQ-2026-111111/status')
      .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`)
      .send({ status: 'Rejected' });
    expect(missing.status).toBe(400);

    const unknown = await request(app)
      .put('/api/v1/admin/quotes/RFQ-2026-111111/status')
      .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`)
      .send({ status: 'Shipped' });
    expect(unknown.status).toBe(400);
    expect(state.prisma.quote.update).not.toHaveBeenCalled();
  });

  it('applies a manual price override with reason and snapshots the engine price', async () => {
    state.setCurrentUser(state.adminUser);
    const res = await request(app)
      .put('/api/v1/admin/quotes/RFQ-2026-111111/price')
      .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`)
      .send({ price: 250, reason: 'Loyalty discount' });

    expect(res.status).toBe(200);
    const payload = state.prisma.quote.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(payload.data.totalPrice).toBe('250.00 EGP');
    expect(payload.data.unitPrice).toBe('125.00 EGP');
    expect(payload.data.systemTotalPrice).toBe('200.00 EGP');
    expect(payload.data.priceOverrideReason).toBe('Loyalty discount');
    expect(state.prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it('rejects price overrides without a meaningful reason or with invalid values', async () => {
    state.setCurrentUser(state.adminUser);
    const noReason = await request(app)
      .put('/api/v1/admin/quotes/RFQ-2026-111111/price')
      .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`)
      .send({ price: 250, reason: 'ok' });
    expect(noReason.status).toBe(400);

    const badPrice = await request(app)
      .put('/api/v1/admin/quotes/RFQ-2026-111111/price')
      .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`)
      .send({ price: -5, reason: 'Valid reason here' });
    expect(badPrice.status).toBe(400);
    expect(state.prisma.quote.update).not.toHaveBeenCalled();
  });

  it('updates technical notes within the length limit', async () => {
    state.setCurrentUser(state.adminUser);
    const res = await request(app)
      .put('/api/v1/admin/quotes/RFQ-2026-111111/notes')
      .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`)
      .send({ technicalNotes: 'Handle with care.' });

    expect(res.status).toBe(200);
    expect(state.prisma.quote.update).toHaveBeenCalledOnce();
  });

  it('persists quote messages and lists them back', async () => {
    state.setCurrentUser(state.adminUser);
    const sent = await request(app)
      .post('/api/v1/admin/quotes/RFQ-2026-111111/message')
      .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`)
      .send({ message: 'Your quote is ready.', subject: 'RFQ update' });

    expect(sent.status).toBe(201);
    expect(state.prisma.quoteMessage.create).toHaveBeenCalledOnce();
    const payload = state.prisma.quoteMessage.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(payload.message).toBe('Your quote is ready.');
    expect(state.prisma.auditLog.create).toHaveBeenCalledOnce();

    const listed = await request(app)
      .get('/api/v1/admin/quotes/RFQ-2026-111111/messages')
      .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`);
    expect(listed.status).toBe(200);
  });

  it('rejects empty messages and guards mutations behind staff roles', async () => {
    state.setCurrentUser(state.adminUser);
    const empty = await request(app)
      .post('/api/v1/admin/quotes/RFQ-2026-111111/message')
      .set('Cookie', `${SESSION_COOKIE_NAME}=admintoken`)
      .send({ message: '   ' });
    expect(empty.status).toBe(400);

    state.setCurrentUser(state.customerUser);
    const forbidden = await request(app)
      .put('/api/v1/admin/quotes/RFQ-2026-111111/status')
      .set('Cookie', `${SESSION_COOKIE_NAME}=customertoken`)
      .send({ status: 'Revised' });
    expect(forbidden.status).toBe(403);

    const unauthenticated = await request(app)
      .put('/api/v1/admin/quotes/RFQ-2026-111111/price')
      .send({ price: 10, reason: 'Valid reason' });
    expect(unauthenticated.status).toBe(401);
  });
});
