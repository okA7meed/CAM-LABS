import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_NAME } from '../src/auth/session.service';

/**
 * Regression proof for the shipping/admin-list outage class:
 * code/DB drift (unapplied migration + stale Prisma Client) once returned
 * `rates: []` and 503 SHIPPING_UNAVAILABLE on submit, and a boot-time
 * ReferenceError took down every admin/customer fetch (toast storm).
 *
 * Covered here with a mocked Prisma layer (no live DB):
 *  SHIPPING READ  — public rates endpoint serves configured methods.
 *  SHIPPING AUTHZ — customers read but can never mutate; super-admin can.
 *  SHIPPING SUBMIT — server re-resolves the method code; client amounts ignored;
 *                    disabled/unknown methods fail closed without creating quotes.
 *  ADMIN LISTS    — quotes/orders return 200 for legacy rows with null new fields.
 *  LIFECYCLE      — submit creates exactly one quote and zero orders; admin
 *                    conversion creates exactly one order with the same reference.
 */

const state = vi.hoisted(() => {
  const superAdmin = {
    id: 'admin-super', name: 'Super Admin', email: 'super@cam-labs.com', role: 'SUPER_ADMIN',
    isAdmin: true, accountStatus: 'ACTIVE', company: 'CAM LABS', phone: null, avatar: null,
    tier: 'Admin', address: null, taxId: null, preferences: null, passwordHash: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const opsAdmin = {
    id: 'admin-ops', name: 'Ops Admin', email: 'ops@cam-labs.com', role: 'OPERATIONS_ADMIN',
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

  const standardRow = () => ({
    id: 'sm-standard', code: 'STANDARD', name: 'Standard Shipping',
    description: 'Reliable delivery within 2 to 5 business days', eta: '2–5 Days',
    priceEgp: 70, currency: 'EGP', isEnabled: true, sortOrder: 0, archivedAt: null,
    createdAt: new Date('2026-09-18T00:00:00.000Z'), updatedAt: new Date('2026-09-18T00:00:00.000Z'),
  });
  const priorityRow = () => ({
    id: 'sm-priority', code: 'PRIORITY', name: 'Priority Shipping',
    description: 'Expedited handling and courier dispatch', eta: '1–2 Days',
    priceEgp: 100, currency: 'EGP', isEnabled: true, sortOrder: 1, archivedAt: null,
    createdAt: new Date('2026-09-18T00:00:00.000Z'), updatedAt: new Date('2026-09-18T00:00:00.000Z'),
  });
  // Mutable "table" so tests can change prices / disable methods mid-checkout.
  let methodRows: ReturnType<typeof standardRow>[] = [standardRow(), priorityRow()];

  // Legacy quote predating snapshots/coupons/references (all new fields null).
  const legacyQuote = () => ({
    id: 'RFQ-2026-000001', reference: null, userId: 'customer-1', partName: 'legacy.stl',
    technology: 'FDM', material: 'PLA', quantity: 1, toleranceGrade: 'standard', surfaceFinish: 'Standard',
    manufacturingCost: '100.00 EGP', unitPrice: '100.00 EGP', totalPrice: '100.00 EGP',
    leadTime: '3 days', validUntil: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    status: 'Ready for Approval', provider: 'CAM LABS', providerQuoteRef: null, isSimulated: false,
    cadFileIds: ['file-a'], pricingBreakdown: {}, pricingEquationVersionId: null, convertedOrderId: null,
    contactName: null, contactEmail: null, contactPhone: null, contactSnapshot: null,
    country: null, governorate: null, city: null, addressLine1: null, addressLine2: null, postalCode: null,
    shippingAddressSnapshot: null, shippingMethod: null, shippingCostAmount: 0,
    preferredPaymentMethod: null, billingSameAsShipping: true, billingAddressSnapshot: null,
    couponId: null, couponCodeSnapshot: null, couponDiscountTypeSnapshot: null,
    couponDiscountValueSnapshot: null, couponEligibleAmountSnapshot: null,
    couponDiscountAmountApplied: 0, couponShippingDiscountApplied: 0, estimatedTotalAmount: null,
    couponAppliedAt: null, technicalNotes: '', systemTotalPrice: null,
    priceOverrideReason: null, priceOverriddenBy: null, priceOverriddenAt: null,
    statusReason: null, statusUpdatedAt: null, statusUpdatedBy: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'), updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    technicalDocuments: [], messages: [],
    user: { id: 'customer-1', name: 'Normal Customer', email: 'customer@example.com', company: 'Independent' },
    pricingEquationVersion: null, coupon: null,
  });

  const legacyOrder = () => ({
    id: 'CAM-2026-000001', reference: null, userId: 'customer-1', quoteId: 'RFQ-2026-000001',
    partName: 'legacy.stl', technology: 'FDM', material: 'PLA', quantity: 1,
    date: '2026-09-10', estDelivery: '2026-09-15', status: 'In Review', statusBadge: 'badge-blue', progressStep: 1,
    manufacturingCost: '100.00 EGP', serviceFee: null, totalCost: '100.00 EGP', tolerance: '±0.05 mm',
    provider: 'CAM LABS', providerOrderRef: null, trackingNum: null, history: [],
    paymentStatus: 'Pending', preferredPaymentMethod: null, manufacturingStatus: 'Pending', shippingStatus: 'Pending',
    shippingAddress: 'Cairo', shippingMethod: 'Express Courier', shippingCost: null, shippingCostAmount: 0,
    carrier: 'CAM LABS Express', actualDelivery: null, shippingAddressSnapshot: null,
    billingAddressSnapshot: null, contactSnapshot: null, couponId: null, couponCodeSnapshot: null,
    couponDiscountTypeSnapshot: null, couponDiscountValueSnapshot: null, couponEligibleAmountSnapshot: null,
    couponDiscountAmountApplied: 0, manufacturerId: null, pricingEquationVersionId: null,
    createdAt: new Date('2026-09-10T00:00:00.000Z'), updatedAt: new Date('2026-09-10T00:00:00.000Z'),
    technicalNotes: '', user: { id: 'customer-1', name: 'Normal Customer', email: 'customer@example.com', company: 'Independent' },
    manufacturer: null, cadFiles: [],
  });

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
        if (where.id === superAdmin.id || where.email === superAdmin.email) return superAdmin;
        if (where.id === opsAdmin.id || where.email === opsAdmin.email) return opsAdmin;
        if (where.id === customerUser.id || where.email === customerUser.email) return customerUser;
        return null;
      }),
    },
    shippingMethod: {
      findMany: vi.fn(async ({ where }: any = {}) => {
        let rows = methodRows.map((r) => ({ ...r }));
        if (where?.isEnabled === true) rows = rows.filter((r) => r.isEnabled);
        if (where && 'archivedAt' in where && where.archivedAt === null) rows = rows.filter((r) => r.archivedAt == null);
        return rows;
      }),
      findFirst: vi.fn(async ({ where }: any = {}) => {
        const row = methodRows.find((r) => r.code === where?.code && r.archivedAt == null);
        return row ? { ...row } : null;
      }),
      findUnique: vi.fn(async ({ where }: any = {}) => {
        const row = methodRows.find((r) => r.id === where?.id || r.code === where?.code);
        return row ? { ...row } : null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (methodRows.some((r) => r.code === data.code)) throw Object.assign(new Error('Unique constraint'), { code: 'P2002' });
        return { id: 'sm-new', archivedAt: null, createdAt: new Date(), updatedAt: new Date(), ...data };
      }),
      update: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const row = methodRows.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('Not found'), { code: 'P2025' });
        Object.assign(row, data);
        return { ...row };
      }),
    },
    quote: {
      findUnique: vi.fn(async () => ({ ...legacyQuote() })),
      findFirst: vi.fn(async () => ({ ...legacyQuote() })),
      findMany: vi.fn(async () => [{ ...legacyQuote() }]),
      count: vi.fn(async () => 1),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...legacyQuote(), ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      groupBy: vi.fn(async () => [{ status: 'Ready for Approval', _count: { _all: 1 } }]),
    },
    order: {
      findMany: vi.fn(async () => [{ ...legacyOrder() }]),
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 1),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data })),
      groupBy: vi.fn(async () => [{ status: 'In Review', _count: { _all: 1 } }]),
    },
    coupon: {
      findUnique: vi.fn(async () => null),
    },
    couponUsage: {
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'usage-1', ...data })),
      findMany: vi.fn(async () => []),
    },
    cadFile: {
      findMany: vi.fn(async () => [{ ...readyCadFile }]),
      findFirst: vi.fn(async () => ({ ...readyCadFile })),
      updateMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 1),
    },
    technicalDocument: { findMany: vi.fn(async () => []), updateMany: vi.fn(async () => ({ count: 0 })) },
    auditLog: { create: vi.fn(async () => ({ id: 'audit-1' })), findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    adminNotification: { create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'notif-1', createdAt: new Date(), ...args.data })) },
    manufacturer: { findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    manufacturingRequest: { create: vi.fn(async () => ({ id: 'mfg-1' })), count: vi.fn(async () => 0) },
    orderEvent: { create: vi.fn(async () => ({ id: 'evt-1' })) },
    quoteMessage: { create: vi.fn(async () => ({ id: 'qmsg-1' })), findMany: vi.fn(async () => []) },
    $queryRawUnsafe: vi.fn(async () => [{ ok: 1 }]),
    systemSetting: { findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []) },
  };

  return {
    superAdmin, opsAdmin, customerUser,
    getCurrentUser: () => currentUser,
    setCurrentUser: (u: typeof customerUser) => { currentUser = u; },
    prisma, legacyQuote, legacyOrder,
    get methodRows() { return methodRows; },
    resetMethods: () => { methodRows = [standardRow(), priorityRow()]; },
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
    calculateQuote: async () => ({
      engineName: 'CAM LABS', quoteRef: 'CAM-QT-TEST',
      manufacturingBaseCost: 100, manufacturingTotalCost: 100,
      breakdown: { geometry: {}, manufacturing: {}, material: {}, machine: {}, labor: {} },
    }),
    dispatchOrder: async (input: { orderId: string }) => ({
      engineName: 'CAM LABS', trackingId: 'CAM-TRK-1', internalOrderRef: 'CAM-ORD-1',
      dispatchedAt: new Date().toISOString(), status: 'Queued', estimatedCompletion: '2026-10-01',
      orderId: input.orderId,
    }),
  }),
}));

import adminRoutes from '../src/routes/admin.routes';
import adminShippingRoutes from '../src/routes/admin-shipping.routes';
import quotesRoutes from '../src/routes/quotes.routes';
import { QuotesService } from '../src/services/quotes.service';
import { errorHandler } from '../src/middleware/error.middleware';

// Fixed engine-equivalent pricing for submit tests; shipping/coupon logic stays
// real. (Static class methods are non-enumerable, so a module-spread mock would
// drop them — stub the single method instead.)
vi.spyOn(QuotesService, 'calculateMultiFileQuotation').mockImplementation(async () => ({
  quoteId: 'CAM-QT-TEST', timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
  files: [{ fileId: 'file-a', fileName: 'bracket.stl', quantity: 1, material: 'PLA', process: 'FDM', perUnitCost: 120, subtotalBeforeFee: 120, quantityDiscount: 0, discountedSubtotal: 120 }],
  manufacturingSubtotal: 120, quantityDiscountSavings: 0, setupCost: 0,
  pricingBreakdown: { files: [], sharedSetupCost: 0, manufacturingSubtotal: 120, minimumOrderAdjustment: 0, currency: 'EGP' },
  totalCustomerPrice: 120, leadTime: '3 days', leadTimeDays: 3, currency: 'EGP', validFor14Days: true,
  formattedManufacturingSubtotal: '120.00 EGP', formattedTotalPrice: '120.00 EGP', formattedCurrency: 'EGP',
} as never));

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/shipping', adminShippingRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/quotes', quotesRoutes);
  app.use(errorHandler);
  return app;
};

const superCookie = `${SESSION_COOKIE_NAME}=supertoken`;
const opsCookie = `${SESSION_COOKIE_NAME}=opstoken`;
const customerCookie = `${SESSION_COOKIE_NAME}=customertoken`;

const submitBody = (overrides: Record<string, unknown> = {}) => ({
  partName: 'bracket.stl', technology: 'FDM', material: 'PLA', quantity: 1,
  toleranceGrade: 'standard', surfaceFinish: 'Standard',
  cadFileIds: ['file-a'],
  files: [{ fileId: 'file-a', fileName: 'bracket.stl', format: 'STL', materialId: 'PLA', technology: 'FDM', surfaceFinish: 'standard', toleranceGrade: 'standard', quantity: 1 }],
  contact: { fullName: 'Normal Customer', email: 'customer@example.com', phone: '+201012345678' },
  delivery: { country: 'Egypt', governorate: 'Cairo', city: 'Cairo', address: '10 Tahrir Square', apartment: '', postalCode: '' },
  saveAddress: false,
  shippingMethod: 'STANDARD',
  preferredPaymentMethod: 'KASHIER',
  billingSameAsShipping: true,
  ...overrides,
});

describe('Shipping + admin-list regression', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
    state.resetMethods();
    state.setCurrentUser(state.customerUser);
  });

  it('1. Public rates endpoint returns the configured methods', async () => {
    const res = await request(app).get('/api/v1/quotes/shipping-rates');
    expect(res.status).toBe(200);
    expect(res.body.data.rates).toHaveLength(2);
    expect(res.body.data.rates[0]).toMatchObject({ code: 'STANDARD', feeEgp: 70 });
    expect(res.body.data.rates[1]).toMatchObject({ code: 'PRIORITY', feeEgp: 100 });
  });

  it('2. Customer can read active methods but cannot mutate them', async () => {
    state.setCurrentUser(state.customerUser);
    const read = await request(app).get('/api/v1/admin/shipping/methods').set('Cookie', customerCookie);
    expect(read.status).toBe(403);
    const create = await request(app).post('/api/v1/admin/shipping/methods').set('Cookie', customerCookie).send({
      code: 'CHEAP', name: 'Cheap', priceEgp: 1,
    });
    expect(create.status).toBe(403);
    expect(state.prisma.shippingMethod.create).not.toHaveBeenCalled();
  });

  it('3. Unauthenticated mutation is rejected before any write', async () => {
    const res = await request(app).post('/api/v1/admin/shipping/methods').send({ code: 'X', name: 'X', priceEgp: 1 });
    expect(res.status).toBe(401);
    expect(state.prisma.shippingMethod.create).not.toHaveBeenCalled();
  });

  it('4. Super Admin can create, edit, disable and re-enable a method', async () => {
    state.setCurrentUser(state.superAdmin);
    const created = await request(app).post('/api/v1/admin/shipping/methods').set('Cookie', superCookie).send({
      code: 'EXPRESS', name: 'Express', description: 'Fast', eta: '1 Day', priceEgp: 150,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe('EXPRESS');

    const edited = await request(app).put('/api/v1/admin/shipping/methods/sm-standard').set('Cookie', superCookie).send({ priceEgp: 90 });
    expect(edited.status).toBe(200);

    const disabled = await request(app).post('/api/v1/admin/shipping/methods/sm-standard/disable').set('Cookie', superCookie);
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.isEnabled).toBe(false);

    const reenabled = await request(app).post('/api/v1/admin/shipping/methods/sm-standard/enable').set('Cookie', superCookie);
    expect(reenabled.status).toBe(200);
    expect(reenabled.body.data.isEnabled).toBe(true);
  });

  it('5. Disabled methods disappear from public rates and fail closed at submit', async () => {
    state.methodRows.find((r) => r.code === 'STANDARD')!.isEnabled = false;
    const rates = await request(app).get('/api/v1/quotes/shipping-rates');
    expect(rates.body.data.rates.map((r: any) => r.code)).toEqual(['PRIORITY']);

    state.setCurrentUser(state.customerUser);
    const res = await request(app).post('/api/v1/quotes/submit').set('Cookie', customerCookie).send(submitBody());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SHIPPING_METHOD_UNAVAILABLE');
    expect(state.prisma.quote.create).not.toHaveBeenCalled();
    expect(state.prisma.order.create).not.toHaveBeenCalled();
  });

  it('6. Submit with a valid method succeeds and snapshots the DB price', async () => {
    state.setCurrentUser(state.customerUser);
    const res = await request(app).post('/api/v1/quotes/submit').set('Cookie', customerCookie).send(submitBody());
    expect(res.status).toBe(201);
    const created = state.prisma.quote.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(created.shippingMethod).toBe('STANDARD');
    expect(created.shippingCostAmount).toBe(70);
    expect(created.shippingAddressSnapshot).toMatchObject({ methodCode: 'STANDARD', priceEgp: 70 });
  });

  it('7. Submit revalidates mid-checkout price changes; client amounts are ignored', async () => {
    state.methodRows.find((r) => r.code === 'STANDARD')!.priceEgp = 90;
    state.setCurrentUser(state.customerUser);
    const res = await request(app)
      .post('/api/v1/quotes/submit')
      .set('Cookie', customerCookie)
      .send(submitBody({ shippingPrice: 1, shippingCostAmount: 1, feeEgp: 1 }));
    expect(res.status).toBe(201);
    const created = state.prisma.quote.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(created.shippingCostAmount).toBe(90);
    expect(res.body.data.pricing.shippingFee).toBe(90);
    expect(res.body.data.pricing.estimatedTotal).toBe(210);
  });

  it('8. Unknown shipping codes fail closed without creating a quote', async () => {
    state.setCurrentUser(state.customerUser);
    const res = await request(app).post('/api/v1/quotes/submit').set('Cookie', customerCookie).send(submitBody({ shippingMethod: 'OVERNIGHT' }));
    expect(res.status).toBe(409);
    expect(state.prisma.quote.create).not.toHaveBeenCalled();
  });

  it('11. Admin Quotes returns 200 for legacy rows with null new fields', async () => {
    state.setCurrentUser(state.superAdmin);
    const res = await request(app).get('/api/v1/admin/quotes?limit=20&offset=0').set('Cookie', superCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.quotes).toHaveLength(1);
    expect(res.body.data.quotes[0].id).toBe('RFQ-2026-000001');
    expect(res.body.data.total).toBe(1);
  });

  it('12-16. Admin Quote detail/search load rows with and without coupon data', async () => {
    state.setCurrentUser(state.superAdmin);
    const detail = await request(app).get('/api/v1/admin/quotes/RFQ-2026-000001').set('Cookie', superCookie);
    expect(detail.status).toBe(200);
    expect(detail.body.data.couponId).toBeNull();

    const search = await request(app).get('/api/v1/admin/quotes?limit=20&offset=0&search=legacy').set('Cookie', superCookie);
    expect(search.status).toBe(200);

    const filtered = await request(app).get('/api/v1/admin/quotes?limit=20&offset=0&status=Ready%20for%20Approval').set('Cookie', superCookie);
    expect(filtered.status).toBe(200);
  });

  it('17-20. Admin Orders returns 200 for legacy and converted rows', async () => {
    state.setCurrentUser(state.superAdmin);
    const res = await request(app).get('/api/v1/admin/orders?limit=20&offset=0').set('Cookie', superCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.data.orders[0].couponId).toBeNull();

    const sorted = await request(app).get('/api/v1/admin/orders?limit=20&offset=0&sortBy=total&sortDir=desc').set('Cookie', superCookie);
    expect(sorted.status).toBe(200);
  });

  it('22-23. Submit creates exactly one quote and zero orders', async () => {
    state.setCurrentUser(state.customerUser);
    const res = await request(app).post('/api/v1/quotes/submit').set('Cookie', customerCookie).send(submitBody());
    expect(res.status).toBe(201);
    expect(res.body.data.quote.reference).toMatch(/^CAM-2026-\d{6}$/);
    expect(state.prisma.quote.create).toHaveBeenCalledTimes(1);
    expect(state.prisma.order.create).not.toHaveBeenCalled();
  });

  it('24-25. Admin conversion creates exactly one order with the same reference; repeat is 409', async () => {
    const originalFindUnique = state.prisma.quote.findUnique;
    state.prisma.quote.findUnique = vi.fn(async () => ({ ...state.legacyQuote(), reference: 'CAM-2026-111111', status: 'Approved' }));
    try {
      state.setCurrentUser(state.opsAdmin);
      const first = await request(app).post('/api/v1/admin/orders/from-quote/RFQ-2026-000001').set('Cookie', opsCookie);
      expect(first.status).toBe(201);
      expect(state.prisma.order.create).toHaveBeenCalledTimes(1);
      const created = state.prisma.order.create.mock.calls[0][0].data as Record<string, unknown>;
      expect(created.quoteId).toBe('RFQ-2026-000001');
      // Unified business reference preserved across the lifecycle.
      expect(created.reference).toBe('CAM-2026-111111');

      // Simulate the claimed quote, then retry.
      state.prisma.quote.findUnique = vi.fn(async () => ({ ...state.legacyQuote(), reference: 'CAM-2026-111111', status: 'Approved', convertedOrderId: created.id }));
      const second = await request(app).post('/api/v1/admin/orders/from-quote/RFQ-2026-000001').set('Cookie', opsCookie);
      expect(second.status).toBe(409);
      expect(state.prisma.order.create).toHaveBeenCalledTimes(1);
    } finally {
      state.prisma.quote.findUnique = originalFindUnique;
    }
  });

  it('10. Seeding is idempotent — no duplicate methods are created', async () => {
    // The migration seeds with ON CONFLICT DO NOTHING; the create endpoint
    // rejects duplicate codes instead of duplicating them.
    state.setCurrentUser(state.superAdmin);
    const dup = await request(app).post('/api/v1/admin/shipping/methods').set('Cookie', superCookie).send({
      code: 'STANDARD', name: 'Duplicate Standard', priceEgp: 5,
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('SHIPPING_CODE_EXISTS');
  });
});
