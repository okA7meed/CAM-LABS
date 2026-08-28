/**
 * Phase 08 — Hardening, Security & Data Integrity tests.
 *
 * Covers the Phase 8 hardening work:
 *  - Quote → order single-conversion (idempotency) & strict ownership
 *  - Server-issued order PKs and stripping of client price fields
 *  - Two-way CAD-file matching between quote and order
 *  - Manufacturing status/dispatch ownership (IDOR) & quote bounds
 *  - Generic route error sanitization (no internal detail leakage)
 *  - RBAC rank boundaries used by the new gates
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/utils/errors';
import { hasRole, ROLES } from '../src/auth/roles';

const state = vi.hoisted(() => ({
  authUser: { id: 'user-a', role: 'CUSTOMER' },
  quote: null as any,
  dispatchOrder: vi.fn(),
  orderCreate: vi.fn(),
  quoteUpdateMany: vi.fn(),
  quoteUpdate: vi.fn(),
  cadFindMany: vi.fn(),
  orderFindUnique: vi.fn(),
  orderFindFirst: vi.fn(),
  engineGetStatus: vi.fn(),
  engineQuote: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  getPrismaClient: () => ({
    quote: {
      findUnique: vi.fn(async () => state.quote),
      update: state.quoteUpdate,
      updateMany: state.quoteUpdateMany,
    },
    user: { findUnique: vi.fn(async () => ({ address: null })) },
    cadFile: { findMany: state.cadFindMany, updateMany: vi.fn() },
    order: {
      create: state.orderCreate,
      update: vi.fn(async () => ({ id: 'order-1' })),
      findUnique: state.orderFindUnique,
      findFirst: state.orderFindFirst,
    },
    manufacturingRequest: { create: vi.fn(async () => ({ id: 'mfg-1' })) },
    orderEvent: { create: vi.fn(async () => ({ id: 'evt-1' })) },
    manufacturer: { findUnique: vi.fn(async () => ({ id: 'cell-1', companyName: 'CAM LABS Internal Manufacturing Cell' })) },
  }),
}));

vi.mock('../src/middleware/auth.middleware', () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.auth = state.authUser; next(); },
  getGuestCadId: () => undefined,
}));

vi.mock('../src/providers/manufacturing', () => ({
  getManufacturingEngine: () => ({
    dispatchOrder: state.dispatchOrder,
    getOrderStatus: state.engineGetStatus,
    calculateQuote: state.engineQuote,
  }),
}));

import { OrdersService } from '../src/services/orders.service';
import manufacturingRoutes from '../src/routes/manufacturing.routes';

const makeQuote = (overrides: Record<string, unknown> = {}) => ({
  id: 'quote-1', userId: 'user-a', partName: 'part.stl', technology: 'FDM', material: 'PLA', quantity: 1,
  toleranceGrade: 'standard', surfaceFinish: 'standard', manufacturingCost: '$15.00', serviceFee: null,
  unitPrice: '$15.00', totalPrice: '$15.00', leadTime: '24 - 48 Hours',
  validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), status: 'Ready for Approval',
  provider: 'CAM LABS', providerQuoteRef: 'CAM-QUOTE-1', isSimulated: false, cadFileIds: ['file-a'],
  ...overrides,
});

const orderRequest = (overrides: Record<string, unknown> = {}) => ({
  id: 'CAM-2026-9999',
  userId: 'user-a',
  quoteId: 'quote-1',
  partName: 'part.stl',
  technology: 'FDM',
  material: 'PLA',
  quantity: 1,
  totalCost: '$0.01',
  cadFileIds: ['file-a'],
  cadFileConfigs: [{ cadFileId: 'file-a', totalCost: '0.01 EGP' }],
  ...overrides,
}) as any;

const readyCadFile = () => ({
  id: 'file-a',
  versions: [{ processingStatus: 'COMPLETE', metadata: { geometryStatus: 'READY', supportLevel: 'FULLY_SUPPORTED', volume: 10, surfaceArea: 20, dimensions: { width: 10, height: 10, depth: 10 } } }],
});

const dispatchResult = {
  engineName: 'CAM LABS', trackingId: 'CAM-TRK-1', internalOrderRef: 'CAM-ORD-1',
  dispatchedAt: new Date().toISOString(), status: 'Queued', estimatedCompletion: '2026-08-22',
};

describe('Phase 08 order integrity (quote lifecycle)', () => {
  beforeEach(() => {
    state.authUser = { id: 'user-a', role: 'CUSTOMER' };
    state.quote = makeQuote();
    state.dispatchOrder.mockReset();
    state.dispatchOrder.mockResolvedValue(dispatchResult);
    state.orderCreate.mockReset();
    state.orderCreate.mockResolvedValue({ id: 'order-1', totalCost: '$15.00' });
    state.cadFindMany.mockReset();
    state.cadFindMany.mockResolvedValue([readyCadFile()]);
    state.quoteUpdateMany.mockReset();
    state.quoteUpdateMany.mockResolvedValue({ count: 1 });
    state.quoteUpdate.mockReset();
    state.quoteUpdate.mockResolvedValue(state.quote);
  });

  it('rejects creating an order from a quote that has already been converted', async () => {
    state.quote = makeQuote({ convertedOrderId: 'order-2' });
    await expect(OrdersService.createOrder(orderRequest())).rejects.toMatchObject({
      code: 'QUOTE_ALREADY_CONVERTED',
      statusCode: 409,
    });
    expect(state.dispatchOrder).not.toHaveBeenCalled();
  });

  it('ignores client-supplied ids and generates a CAM-2026-###### server id', async () => {
    await OrdersService.createOrder(orderRequest());
    const createData = state.orderCreate.mock.calls[0][0].data;
    expect(createData.id).toMatch(/^CAM-2026-\d{6}$/);
    expect(createData.id).not.toBe('CAM-2026-9999');
  });

  it('never persists a client-supplied per-file totalCost', async () => {
    await OrdersService.createOrder(orderRequest());
    const create = state.orderCreate.mock.calls[0][0].data.cadFiles.create[0];
    expect(create.cadFileId).toBe('file-a');
    expect(create.totalCost).toBeUndefined();
  });

  it('rejects an order that adds CAD files when the quote had none (both directions)', async () => {
    state.quote = makeQuote({ cadFileIds: [] });
    await expect(OrdersService.createOrder(orderRequest())).rejects.toMatchObject({
      code: 'CAD_MISMATCH',
      statusCode: 400,
    });
    expect(state.dispatchOrder).not.toHaveBeenCalled();
  });

  it('allows exactly one conversion of a quote (double spend rejected with 409)', async () => {
    state.quoteUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const first = await OrdersService.convertQuoteToOrder('quote-1');
    expect(first).toBeTruthy();
    await expect(OrdersService.convertQuoteToOrder('quote-1')).rejects.toMatchObject({
      code: 'QUOTE_ALREADY_CONVERTED',
      statusCode: 409,
    });
  });

  it('forwards quoted CAD files into the converted order', async () => {
    state.orderCreate.mockImplementation(({ data }: any) => Promise.resolve({ id: data.id, totalCost: '$15.00' }));
    const order = await OrdersService.convertQuoteToOrder('quote-1');
    expect(order?.id).toMatch(/^CAM-2026-\d{6}$/);
    const data = state.orderCreate.mock.calls[0][0].data;
    expect(data.cadFiles.create.map((c: any) => c.cadFileId).sort()).toEqual(['file-a']);
  });
});

// ---------------------------------------------------------------------------
// Manufacturing ownership (IDOR) & bounds
// ---------------------------------------------------------------------------
describe('Phase 08 manufacturing ownership & bounds', () => {
  const mfgApp = () => { const app = express(); app.use(express.json()); app.use('/api/v1/manufacturing', manufacturingRoutes); return app; };

  beforeEach(() => {
    state.authUser = { id: 'user-a', role: 'CUSTOMER' };
    state.orderFindFirst.mockReset();
    state.orderFindFirst.mockResolvedValue(null);
    state.orderFindUnique.mockReset();
    state.orderFindUnique.mockResolvedValue(null);
    state.engineGetStatus.mockReset();
    state.engineGetStatus.mockResolvedValue({ status: 'UNKNOWN', currentMilestone: 'Tracking ID not found', progressPercentage: 0, telemetry: { trackingId: 'x', node: 'INTERNAL_NODE' } });
    state.engineQuote.mockReset();
    state.engineQuote.mockResolvedValue({ engineName: 'CAM LABS', quoteRef: 'q' });
    state.dispatchOrder.mockReset();
    state.dispatchOrder.mockResolvedValue(dispatchResult);
  });

  it('denies another customer reading an order tracking status (IDOR)', async () => {
    state.orderFindFirst.mockResolvedValue({ id: 'order-b', userId: 'user-b' });
    const res = await request(mfgApp()).get('/api/v1/manufacturing/status/CAM-TRK-X');
    expect(res.status).toBe(403);
    expect(state.engineGetStatus).not.toHaveBeenCalled();
  });

  it('allows the owner to read their own order tracking status', async () => {
    state.orderFindFirst.mockResolvedValue({ id: 'order-a', userId: 'user-a' });
    const res = await request(mfgApp()).get('/api/v1/manufacturing/status/CAM-TRK-X');
    expect(res.status).toBe(200);
    expect(state.engineGetStatus).toHaveBeenCalledWith('CAM-TRK-X');
  });

  it('denies dispatching another customer order', async () => {
    state.orderFindUnique.mockResolvedValue({ id: 'order-b', userId: 'user-b' });
    const res = await request(mfgApp()).post('/api/v1/manufacturing/dispatch').send({ orderId: 'order-b', quantity: 1 });
    expect(res.status).toBe(403);
    expect(state.dispatchOrder).not.toHaveBeenCalled();
  });

  it('allows dispatching an owned order', async () => {
    state.orderFindUnique.mockResolvedValue({ id: 'order-a', userId: 'user-a' });
    const res = await request(mfgApp()).post('/api/v1/manufacturing/dispatch').send({ orderId: 'order-a', quantity: 1 });
    expect(res.status).toBe(201);
    expect(state.dispatchOrder).toHaveBeenCalled();
  });

  it('rejects out-of-bounds manufacturing quote quantities', async () => {
    const bad = await request(mfgApp()).post('/api/v1/manufacturing/quote').send({ materialId: 'pla', technology: 'FDM', quantity: 0, volumeCm3: 1, surfaceAreaCm2: 2 });
    expect(bad.status).toBe(400);
    const huge = await request(mfgApp()).post('/api/v1/manufacturing/quote').send({ materialId: 'pla', technology: 'FDM', quantity: 10001, volumeCm3: 1, surfaceAreaCm2: 2 });
    expect(huge.status).toBe(400);
    expect(state.engineQuote).not.toHaveBeenCalled();
  });

  it('does not leak internal error details to API clients', async () => {
    state.engineQuote.mockRejectedValue(new Error('pg://postgres:secret@internal-db:5432/cam_labs_db leaked credential'));
    const res = await request(mfgApp()).post('/api/v1/manufacturing/quote').send({ materialId: 'pla', technology: 'FDM', quantity: 1, volumeCm3: 1, surfaceAreaCm2: 2 });
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Quote could not be calculated.');
    expect(JSON.stringify(res.body)).not.toContain('pg://');
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });
});

// ---------------------------------------------------------------------------
// RBAC rank boundaries relied on by the new gates
// ---------------------------------------------------------------------------
describe('Phase 08 RBAC rank boundaries', () => {
  it('treats rank >= SUPPORT_ADMIN as staff for quote viewing', () => {
    expect(hasRole(ROLES.SUPPORT_ADMIN, [ROLES.SUPPORT_ADMIN])).toBe(true);
    expect(hasRole(ROLES.FINANCE_ADMIN, [ROLES.SUPPORT_ADMIN])).toBe(true);
    expect(hasRole(ROLES.CUSTOMER, [ROLES.SUPPORT_ADMIN])).toBe(false);
    expect(hasRole(ROLES.MAKER, [ROLES.SUPPORT_ADMIN])).toBe(false);
  });

  it('treats rank >= OPERATIONS_ADMIN as order staff', () => {
    expect(hasRole(ROLES.OPERATIONS_ADMIN, [ROLES.OPERATIONS_ADMIN])).toBe(true);
    expect(hasRole(ROLES.ADMIN, [ROLES.OPERATIONS_ADMIN])).toBe(true);
    expect(hasRole(ROLES.SUPER_ADMIN, [ROLES.OPERATIONS_ADMIN])).toBe(true);
    expect(hasRole(ROLES.PRICING_ADMIN, [ROLES.OPERATIONS_ADMIN])).toBe(false);
    expect(hasRole(ROLES.CUSTOMER, [ROLES.OPERATIONS_ADMIN])).toBe(false);
  });

  it('preserves AppError status code semantics for new business errors', () => {
    const notOwned = new AppError('not owned', 403, 'QUOTE_NOT_OWNED');
    expect(notOwned.statusCode).toBe(403);
    expect(notOwned.code).toBe('QUOTE_NOT_OWNED');
    const converted = new AppError('converted', 409, 'QUOTE_ALREADY_CONVERTED');
    expect(converted.statusCode).toBe(409);
  });
});