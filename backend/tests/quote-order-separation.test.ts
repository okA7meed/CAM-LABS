import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_NAME } from '../src/auth/session.service';

/**
 * Quote → Order domain separation proof.
 *
 * Invariants under test (no new behavior is introduced here — these lock in
 * the existing architecture):
 *  A. Creating a Quote alone NEVER implies that an Order exists.
 *  B. An unconverted Quote NEVER appears as an Order.
 *  C. An unconverted Quote NEVER contributes to Total Orders.
 *  D. Canonical conversion creates exactly ONE Order.
 *  E. The original Quote remains historically available.
 *  F. Quote and Order are linked via convertedOrderId / quoteId.
 *  G. Repeated conversion cannot create duplicate Orders (409).
 *  H. Presentation reflects backend truth (lists query their own tables).
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
    id: 'RFQ-2026-111111', reference: 'CAM-2026-111111', userId: 'customer-1', partName: 'bracket.stl', technology: 'FDM',
    material: 'PLA', quantity: 1, toleranceGrade: 'standard', surfaceFinish: 'Standard',
    manufacturingCost: '100.00 EGP', unitPrice: '120.00 EGP', totalPrice: '120.00 EGP',
    leadTime: '3 days', validUntil: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    status: 'Ready for Approval', provider: 'CAM LABS', cadFileIds: ['file-a'],
    technicalNotes: '', pricingBreakdown: {}, convertedOrderId: null,
    systemTotalPrice: null, technicalDocuments: [], messages: [],
  });
  let quote: ReturnType<typeof freshQuote> = freshQuote();

  const orderRows = [
    { id: 'CAM-2026-000001', userId: 'customer-1', status: 'In Review', totalCost: '120.00 EGP', createdAt: new Date('2026-09-10T10:00:00.000Z') },
    { id: 'CAM-2026-000002', userId: 'customer-1', status: 'Delivered', totalCost: '1,000.00 EGP', createdAt: new Date('2026-09-11T10:00:00.000Z') },
  ];

  const readyCadFile = {
    id: 'file-a',
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    versions: [{
      processingStatus: 'COMPLETE',
      metadata: { geometryStatus: 'READY', supportLevel: 'FULLY_SUPPORTED', volume: 10, surfaceArea: 20, dimensions: { width: 10, height: 10, depth: 10 } },
    }],
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
      findMany: vi.fn(async () => [{ ...customerUser, createdAt: new Date('2026-09-01T10:00:00.000Z') }]),
      count: vi.fn(async () => 7),
    },
    quote: {
      findUnique: vi.fn(async () => ({ ...quote })),
      findMany: vi.fn(async () => [{ ...quote, createdAt: new Date('2026-09-05T10:00:00.000Z') }]),
      count: vi.fn(async () => 3),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { quote = { ...quote, ...data } as typeof quote; return { ...quote }; }),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { quote = { ...quote, ...data } as typeof quote; return { count: 1 }; }),
    },
    order: {
      findMany: vi.fn(async () => orderRows.map((o) => ({ ...o }))),
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 2),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data })),
      groupBy: vi.fn(async () => []),
    },
    auditLog: {
      create: vi.fn(async () => ({ id: 'audit-1' })),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    adminNotification: { create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'notif-1', createdAt: new Date(), ...args.data })) },
    cadFile: {
      findMany: vi.fn(async () => [{ ...readyCadFile }]),
      updateMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 11),
    },
    manufacturingRequest: {
      create: vi.fn(async () => ({ id: 'mfg-1' })),
      count: vi.fn(async () => 0),
    },
    orderEvent: { create: vi.fn(async () => ({ id: 'evt-1' })) },
    quoteMessage: { create: vi.fn(async () => ({ id: 'qmsg-1' })), findMany: vi.fn(async () => []) },
    manufacturer: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 4),
    },
    technicalDocument: { findMany: vi.fn(async () => []), updateMany: vi.fn(async () => ({ count: 0 })) },
    $queryRawUnsafe: vi.fn(async () => [{ ok: 1 }]),
    systemSetting: { findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []) },
  };

  return {
    adminUser, customerUser,
    getCurrentUser: () => currentUser,
    setCurrentUser: (u: typeof customerUser) => { currentUser = u; },
    prisma, orderRows, freshQuote,
    get quote() { return quote; },
    set quote(v: typeof quote) { quote = v; },
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
  }),
}));

import adminRoutes from '../src/routes/admin.routes';
import ordersRoutes from '../src/routes/orders.routes';
import quotesRoutes from '../src/routes/quotes.routes';
import { QuotesService } from '../src/services/quotes.service';
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

describe('Quote → Order domain separation', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
    state.quote = state.freshQuote();
    state.setCurrentUser(state.customerUser);
  });

  it('TEST 1: saving a Quote writes a quote row only — never an order', async () => {
    const saved = await QuotesService.saveQuotation({
      userId: 'customer-1', partName: 'bracket.stl', technology: 'FDM', material: 'PLA',
      quantity: 1, toleranceGrade: 'standard', surfaceFinish: 'Standard',
      cadFileIds: ['file-a'],
      pricing: {
        quoteRef: 'CAM-QT-1', manufacturingCostUnit: 100, manufacturingCostTotal: 100,
        totalCustomerPrice: 120, customerUnitPrice: 120,
        formattedManufacturingCost: '100.00 EGP', formattedTotalPrice: '120.00 EGP',
        formattedUnitPrice: '120.00 EGP', currency: 'EGP', leadTime: '3 days',
        discountAppliedPercentage: 0, pricingBreakdown: {},
      } as never,
    });

    expect(saved.status).toBe('Ready for Approval');
    expect(state.prisma.quote.create).toHaveBeenCalledOnce();
    expect(state.prisma.order.create).not.toHaveBeenCalled();
  });

  it('TEST 2: a new unconverted Quote appears in the Quotes endpoints', async () => {
    const mine = await request(app).get('/api/v1/quotes/RFQ-2026-111111').set('Cookie', customerCookie);
    expect(mine.status).toBe(200);
    expect(mine.body.data.id).toBe('RFQ-2026-111111');
    expect(mine.body.data.convertedOrderId).toBeNull();

    state.setCurrentUser(state.adminUser);
    const detail = await request(app).get('/api/v1/admin/quotes/RFQ-2026-111111').set('Cookie', adminCookie);
    expect(detail.status).toBe(200);
  });

  it('TEST 3: an unconverted Quote never appears in the Orders endpoint', async () => {
    state.setCurrentUser(state.adminUser);
    const res = await request(app).get('/api/v1/admin/orders?limit=20&offset=0').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data.orders as Array<{ id: string }>).map((o) => o.id);
    expect(ids).toEqual(['CAM-2026-000001', 'CAM-2026-000002']);
    expect(ids).not.toContain('RFQ-2026-111111');
    expect(state.prisma.quote.findMany).not.toHaveBeenCalled();
    expect(state.prisma.quote.count).not.toHaveBeenCalled();
  });

  it('TEST 4+12+13: dashboard counts real entities — Total Orders from orders, revenue from production orders only', async () => {
    state.setCurrentUser(state.adminUser);
    const res = await request(app).get('/api/v1/admin/dashboard?range=30').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    // order.count mocked to 2, quote.count mocked to 3: no cross-contamination.
    expect(res.body.data.orders.total).toBe(2);
    expect(res.body.data.quotes.total).toBe(3);
    expect(res.body.data.quotes.active).toBe(3);
    // Revenue = production-stage order rows only (120 + 1000 mocked above).
    expect(res.body.data.revenue.total).toBe(1120);
    expect(res.body.data.revenue.orderCount).toBe(2);
  });

  it('TEST 5: admin status change mutates the quote row only — no order is created', async () => {
    state.setCurrentUser(state.adminUser);
    const res = await request(app)
      .put('/api/v1/admin/quotes/RFQ-2026-111111/status')
      .set('Cookie', adminCookie)
      .send({ status: 'Revised', reason: 'Needs review' });
    expect(res.status).toBe(200);
    expect(state.prisma.quote.update).toHaveBeenCalledOnce();
    expect(state.prisma.order.create).not.toHaveBeenCalled();
  });

  it('TEST 6-9: canonical conversion creates exactly one linked Order and retains the Quote', async () => {
    state.setCurrentUser(state.adminUser);
    const res = await request(app).post('/api/v1/orders/convert-quote/RFQ-2026-111111').set('Cookie', adminCookie);
    expect(res.status).toBe(201);
    expect(state.prisma.order.create).toHaveBeenCalledOnce();
    // Atomic reservation claimed the quote exactly once.
    expect(state.prisma.quote.updateMany).toHaveBeenCalledOnce();
    const reservation = state.prisma.quote.updateMany.mock.calls[0][0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(reservation.where).toMatchObject({ id: 'RFQ-2026-111111', convertedOrderId: null });
    expect(reservation.data.status).toBe('Approved');
    // Order links back to the quote...
    const created = state.prisma.order.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(created.quoteId).toBe('RFQ-2026-111111');
    // ...and reuses the unified business reference verbatim (no second reference).
    expect(created.reference).toBe('CAM-2026-111111');
    // ...and the quote row itself is never deleted or replaced.
    expect(state.prisma.quote.update).not.toHaveBeenCalled();
    expect(state.prisma.orderEvent.create).toHaveBeenCalled();
  });

  it('TEST 10-11: repeated conversion is rejected safely with no duplicate order', async () => {
    state.quote = { ...state.freshQuote(), convertedOrderId: 'CAM-2026-000001', status: 'Approved' };
    state.setCurrentUser(state.adminUser);
    const first = await request(app).post('/api/v1/orders/convert-quote/RFQ-2026-111111').set('Cookie', adminCookie);
    const second = await request(app).post('/api/v1/orders/convert-quote/RFQ-2026-111111').set('Cookie', adminCookie);
    expect(first.status).toBe(409);
    expect(second.status).toBe(409);
    expect(first.body.error.code).toBe('QUOTE_ALREADY_CONVERTED');
    expect(state.prisma.order.create).not.toHaveBeenCalled();
  });

  it('guards: order creation without a quote is refused before any write', async () => {
    state.setCurrentUser(state.adminUser);
    const res = await request(app).post('/api/v1/orders').set('Cookie', adminCookie).send({ partName: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('QUOTE_REQUIRED');
    expect(state.prisma.order.create).not.toHaveBeenCalled();
  });

  it('guards: only operations staff may create or convert orders', async () => {
    state.setCurrentUser(state.customerUser);
    const direct = await request(app).post('/api/v1/orders').set('Cookie', customerCookie).send({ quoteId: 'RFQ-2026-111111' });
    expect(direct.status).toBe(403);
    const convert = await request(app).post('/api/v1/orders/convert-quote/RFQ-2026-111111').set('Cookie', customerCookie);
    expect(convert.status).toBe(403);
    expect(state.prisma.order.create).not.toHaveBeenCalled();
  });
});
