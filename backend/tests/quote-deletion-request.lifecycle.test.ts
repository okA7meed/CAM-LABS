import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_NAME } from '../src/auth/session.service';

/**
 * Quote deletion-request lifecycle + converted-quote separation.
 *
 * CASE B: customer files deletion request → 201, quote stays.
 * CASE C: duplicate request → 200 reuse, single PENDING row.
 * CASE D: admin rejects → REJECTED, quote stays.
 * CASE E: admin approves → APPROVED, quote row removed, no order created.
 * CASE F: admin converts → exactly one order, same CAM reference.
 * CASE G: double conversion → 409, no duplicate.
 * CASE J: pending deletion blocks conversion → 409 DELETION_REQUEST_PENDING.
 * Guards: customer cannot approve/reject (403), cannot touch others' quotes.
 */
const state = vi.hoisted(() => {
  const adminUser = {
    id: 'admin-1', name: 'CAM Admin', email: 'admin@cam-labs.com', role: 'OPERATIONS_ADMIN',
    isAdmin: true, accountStatus: 'ACTIVE', company: 'CAM LABS', phone: null, avatar: null,
    tier: 'Admin', address: null, taxId: null, preferences: null, passwordHash: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const customerUser = {
    id: 'customer-1', name: 'Normal Customer', email: 'customer@example.com', role: 'CUSTOMER',
    isAdmin: false, accountStatus: 'ACTIVE', company: 'Independent', phone: null, avatar: null,
    tier: 'Pro Engineer', address: null, taxId: null, preferences: null, passwordHash: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  let currentUser: typeof customerUser = customerUser;

  const freshQuote = () => ({
    id: 'RFQ-2026-222222', reference: 'CAM-2026-222222', userId: 'customer-1', partName: 'bracket.stl',
    technology: 'FDM', material: 'PLA', quantity: 1, toleranceGrade: 'standard', surfaceFinish: 'Standard',
    manufacturingCost: '100.00 EGP', unitPrice: '120.00 EGP', totalPrice: '120.00 EGP',
    leadTime: '3 days', validUntil: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    status: 'Ready for Approval', provider: 'CAM LABS', cadFileIds: ['file-a'],
    technicalNotes: '', pricingBreakdown: {}, convertedOrderId: null as string | null,
    createdAt: new Date('2026-09-20T10:00:00.000Z'),
  });
  let quote: ReturnType<typeof freshQuote> | null = freshQuote();
  const deletionRequests = new Map<string, any>();
  let orderCreated = 0;

  const readyCadFile = {
    id: 'file-a',
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    versions: [{
      processingStatus: 'COMPLETE',
      metadata: { geometryStatus: 'READY', supportLevel: 'FULLY_SUPPORTED', volume: 10, surfaceArea: 20, dimensions: { width: 10, height: 10, depth: 10 } },
    }],
  };

  const matchDeletion = (where: any) => {
    for (const r of deletionRequests.values()) {
      if (where.id && r.id !== where.id) continue;
      if (where.quoteId && r.quoteId !== where.quoteId) continue;
      if (where.status && r.status !== where.status) continue;
      return r;
    }
    return null;
  };

  const prisma: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {
    session: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => ({
        id: 'session-1', tokenHash: where.tokenHash, userId: currentUser.id,
        expiresAt: new Date(Date.now() + 3_600_000), user: currentUser,
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
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (quote && where.id === quote.id ? { ...quote } : null)),
      findMany: vi.fn(async ({ where }: any = {}) => {
        if (!quote) return [];
        if (where.userId && quote.userId !== where.userId) return [];
        if (where.convertedOrderId === null && quote.convertedOrderId !== null) return [];
        return [{ ...quote }];
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (!quote || where.id !== quote.id) {
          const err: any = new Error('not found');
          err.code = 'P2025';
          throw err;
        }
        const removed = { ...quote };
        quote = null;
        return removed;
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (!quote) throw Object.assign(new Error('not found'), { code: 'P2025' });
        quote = { ...quote, ...data } as typeof quote;
        return { ...quote };
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (!quote || where.id !== quote.id) return { count: 0 };
        if (where.convertedOrderId === null && quote.convertedOrderId !== null) return { count: 0 };
        quote = { ...quote, ...data } as typeof quote;
        return { count: 1 };
      }),
    },
    quoteDeletionRequest: {
      findFirst: vi.fn(async ({ where }: any) => (matchDeletion(where) ? { ...matchDeletion(where) } : null)),
      findMany: vi.fn(async ({ where }: any = {}) => {
        const out: any[] = [];
        for (const r of deletionRequests.values()) {
          if (where.quoteId && r.quoteId !== where.quoteId) continue;
          if (where.status && r.status !== where.status) continue;
          out.push({ ...r, quote: quote && quote.id === r.quoteId ? { ...quote, user: { ...customerUser } } : null });
        }
        return out;
      }),
      findUnique: vi.fn(async ({ where, include }: any) => {
        const r = deletionRequests.get(where.id);
        if (!r) return null;
        if (include?.quote) return { ...r, quote: quote && quote.id === r.quoteId ? { ...quote } : null };
        return { ...r };
      }),
      create: vi.fn(async ({ data }: any) => {
        if (matchDeletion({ quoteId: data.quoteId, status: 'PENDING' })) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        const r = { id: `delreq-${deletionRequests.size + 1}`, requestedAt: new Date(), ...data };
        deletionRequests.set(r.id, r);
        return { ...r };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const apply = (target: any) => {
          if (where.status && target.status !== where.status) {
            throw Object.assign(new Error('not found'), { code: 'P2025' });
          }
          Object.assign(target, data);
          return { ...target };
        };
        if (where.id) {
          const r = deletionRequests.get(where.id);
          if (!r) throw Object.assign(new Error('not found'), { code: 'P2025' });
          return apply(r);
        }
        const r = matchDeletion(where);
        if (!r) throw Object.assign(new Error('not found'), { code: 'P2025' });
        return apply(r);
      }),
    },
    order: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        orderCreated += 1;
        return { ...data };
      }),
    },
    cadFile: {
      findMany: vi.fn(async () => [{ ...readyCadFile }]),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    technicalDocument: { findMany: vi.fn(async () => []), updateMany: vi.fn(async () => ({ count: 0 })) },
    auditLog: { create: vi.fn(async () => ({ id: 'audit-1' })) },
    adminNotification: { create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'notif-1', createdAt: new Date(), ...args.data })) },
    manufacturingRequest: { create: vi.fn(async () => ({ id: 'mfg-1' })) },
    orderEvent: { create: vi.fn(async () => ({ id: 'evt-1' })) },
    manufacturer: { findUnique: vi.fn(async () => null) },
  };

  return {
    adminUser, customerUser,
    getCurrentUser: () => currentUser,
    setCurrentUser: (u: typeof customerUser) => { currentUser = u; },
    prisma, freshQuote,
    get quote() { return quote; },
    set quote(v: typeof quote) { quote = v; },
    deletionRequests,
    get orderCreated() { return orderCreated; },
    resetOrderCreated: () => { orderCreated = 0; },
  };
});

vi.mock('../src/config/database', () => ({
  getPrismaClient: () => ({
    ...state.prisma,
    $transaction: async (fn: (tx: unknown) => unknown) => fn(state.prisma),
  }),
}));

vi.mock('../src/providers/manufacturing', () => ({
  getManufacturingEngine: () => ({
    dispatchOrder: async (input: { orderId: string }) => ({
      engineName: 'CAM LABS', trackingId: 'CAM-TRK-1', internalOrderRef: 'CAM-ORD-1',
      dispatchedAt: new Date().toISOString(), status: 'Queued', estimatedCompletion: '2026-10-01',
      orderId: input.orderId,
    }),
    calculateQuote: async () => { throw new Error('not used'); },
  }),
}));

import adminRoutes from '../src/routes/admin.routes';
import ordersRoutes from '../src/routes/orders.routes';
import quotesRoutes from '../src/routes/quotes.routes';
import { errorHandler } from '../src/middleware/error.middleware';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/orders', ordersRoutes);
  app.use('/api/v1/quotes', quotesRoutes);
  app.use(errorHandler);
  return app;
};

const adminCookie = `${SESSION_COOKIE_NAME}=admintoken`;
const customerCookie = `${SESSION_COOKIE_NAME}=customertoken`;

describe('Quote deletion-request lifecycle', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
    state.quote = state.freshQuote();
    state.deletionRequests.clear();
    state.resetOrderCreated();
    state.setCurrentUser(state.customerUser);
  });

  it('CASE B: customer files a deletion request — quote stays visible', async () => {
    const res = await request(app)
      .post('/api/v1/quotes/RFQ-2026-222222/deletion-request')
      .set('Cookie', customerCookie)
      .send({ reason: 'No longer needed' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.quoteId).toBe('RFQ-2026-222222');
    // Quote row untouched.
    expect(state.quote).not.toBeNull();
    expect(state.quote!.convertedOrderId).toBeNull();
  });

  it('CASE C: duplicate request is reused — no second PENDING row', async () => {
    const first = await request(app).post('/api/v1/quotes/RFQ-2026-222222/deletion-request').set('Cookie', customerCookie).send({});
    const second = await request(app).post('/api/v1/quotes/RFQ-2026-222222/deletion-request').set('Cookie', customerCookie).send({});
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(state.deletionRequests.size).toBe(1);
  });

  it('CASE D: admin rejects — quote remains active', async () => {
    const filed = await request(app).post('/api/v1/quotes/RFQ-2026-222222/deletion-request').set('Cookie', customerCookie).send({});
    state.setCurrentUser(state.adminUser);
    const rejected = await request(app)
      .post(`/api/v1/admin/quote-deletion-requests/${filed.body.data.id}/reject`)
      .set('Cookie', adminCookie)
      .send({ adminNote: 'Keep for production planning' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REJECTED');
    expect(state.quote).not.toBeNull();
  });

  it('CASE E: admin approves — quote removed, no order created', async () => {
    const filed = await request(app).post('/api/v1/quotes/RFQ-2026-222222/deletion-request').set('Cookie', customerCookie).send({});
    state.setCurrentUser(state.adminUser);
    const approved = await request(app)
      .post(`/api/v1/admin/quote-deletion-requests/${filed.body.data.id}/approve`)
      .set('Cookie', adminCookie)
      .send({});
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');
    expect(state.quote).toBeNull();
    expect(state.orderCreated).toBe(0);
  });

  it('CASE J: pending deletion blocks conversion until resolved', async () => {
    await request(app).post('/api/v1/quotes/RFQ-2026-222222/deletion-request').set('Cookie', customerCookie).send({});
    state.setCurrentUser(state.adminUser);
    const blocked = await request(app).post('/api/v1/admin/orders/from-quote/RFQ-2026-222222').set('Cookie', adminCookie);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('DELETION_REQUEST_PENDING');
    expect(state.orderCreated).toBe(0);
  });

  it('CASE F+G: conversion creates exactly one order with the same CAM reference; repeat is 409', async () => {
    state.setCurrentUser(state.adminUser);
    const first = await request(app).post('/api/v1/admin/orders/from-quote/RFQ-2026-222222').set('Cookie', adminCookie);
    expect(first.status).toBe(201);
    expect(state.orderCreated).toBe(1);
    expect(first.body.data.reference).toBe('CAM-2026-222222');
    expect(first.body.data.quoteId).toBe('RFQ-2026-222222');

    const second = await request(app).post('/api/v1/admin/orders/from-quote/RFQ-2026-222222').set('Cookie', adminCookie);
    expect(second.status).toBe(409);
    expect(state.orderCreated).toBe(1);
  });

  it('customer cannot approve or reject deletion requests (403)', async () => {
    const filed = await request(app).post('/api/v1/quotes/RFQ-2026-222222/deletion-request').set('Cookie', customerCookie).send({});
    const approve = await request(app)
      .post(`/api/v1/admin/quote-deletion-requests/${filed.body.data.id}/approve`)
      .set('Cookie', customerCookie)
      .send({});
    expect(approve.status).toBe(403);
    const reject = await request(app)
      .post(`/api/v1/admin/quote-deletion-requests/${filed.body.data.id}/reject`)
      .set('Cookie', customerCookie)
      .send({});
    expect(reject.status).toBe(403);
    expect(state.quote).not.toBeNull();
  });

  it('customer cannot file a request for another customer quote (404, no oracle)', async () => {
    state.quote = { ...state.freshQuote(), userId: 'someone-else' };
    const res = await request(app).post('/api/v1/quotes/RFQ-2026-222222/deletion-request').set('Cookie', customerCookie).send({});
    expect(res.status).toBe(404);
    expect(state.deletionRequests.size).toBe(0);
  });

  it('direct DELETE stays disabled (410) and never removes the row', async () => {
    const res = await request(app).delete('/api/v1/quotes/RFQ-2026-222222').set('Cookie', customerCookie);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('QUOTE_DELETE_DISABLED');
    expect(state.quote).not.toBeNull();
  });

  it('converted quotes leave the customer active list (convertedOrderId IS NULL)', async () => {
    state.setCurrentUser(state.adminUser);
    await request(app).post('/api/v1/admin/orders/from-quote/RFQ-2026-222222').set('Cookie', adminCookie);
    state.setCurrentUser(state.customerUser);
    const mine = await request(app).get('/api/v1/quotes').set('Cookie', customerCookie);
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(0);
  });
});
