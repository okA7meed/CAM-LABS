import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authUser: { id: 'user-a', role: 'CUSTOMER' },
  quote: null as any,
  dispatchOrder: vi.fn(),
  orderCreate: vi.fn(),
  cadFindMany: vi.fn(),
}));

vi.mock('../src/middleware/auth.middleware', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.auth = state.authUser;
    next();
  },
  getGuestCadId: () => undefined,
}));

vi.mock('../src/config/database', () => ({
  getPrismaClient: () => ({
    quote: { findUnique: vi.fn(async () => state.quote), update: vi.fn(async () => state.quote) },
    cadFile: { findMany: state.cadFindMany, updateMany: vi.fn() },
    order: { create: state.orderCreate },
  }),
}));

vi.mock('../src/providers/manufacturing', () => ({
  getManufacturingEngine: () => ({ dispatchOrder: state.dispatchOrder }),
}));

import ordersRoutes from '../src/routes/orders.routes';

const makeQuote = (overrides: Record<string, unknown> = {}) => ({
  id: 'quote-1', userId: 'user-a', partName: 'part.stl', technology: 'FDM', material: 'PLA', quantity: 1,
  toleranceGrade: 'standard', surfaceFinish: 'standard', manufacturingCost: '$15.00', serviceFee: null,
  unitPrice: '$15.00', totalPrice: '$15.00', leadTime: '24 - 48 Hours',
  validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), status: 'Ready for Approval',
  provider: 'CAM LABS', providerQuoteRef: 'CAM-QUOTE-1', isSimulated: false, cadFileIds: ['file-a'], ...overrides,
});

const orderBody = (overrides: Record<string, unknown> = {}) => ({
  quoteId: 'quote-1', partName: 'part.stl', technology: 'FDM', material: 'PLA', quantity: 1,
  totalCost: '$0.01', totalPrice: '$0.01', serviceFee: '$999.00', platformServiceFee: '$999.00', providerPrice: '$0.01',
  validUntil: '2099-01-01T00:00:00.000Z', cadFileIds: ['file-a'], ...overrides,
});

const readyCadFile = (overrides: Record<string, unknown> = {}) => ({
  id: 'file-a',
  versions: [{
    processingStatus: 'COMPLETE',
    metadata: { geometryStatus: 'READY', supportLevel: 'FULLY_SUPPORTED', volume: 10, surfaceArea: 20, dimensions: { width: 10, height: 10, depth: 10 } },
    ...overrides,
  }],
});

const createApp = () => { const app = express(); app.use(express.json()); app.use('/api/v1/orders', ordersRoutes); return app; };

describe('Phase 04 order HTTP trust boundary', () => {
  beforeEach(() => {
    state.authUser = { id: 'user-a', role: 'CUSTOMER' };
    state.quote = makeQuote();
    state.dispatchOrder.mockReset();
    state.dispatchOrder.mockResolvedValue({ engineName: 'CAM LABS', trackingId: 'CAM-TRK-1', internalOrderRef: 'CAM-ORD-1', dispatchedAt: new Date().toISOString(), status: 'Queued', estimatedCompletion: '2026-08-22' });
    state.orderCreate.mockReset();
    state.orderCreate.mockResolvedValue({ id: 'order-1', totalCost: '$15.00' });
    state.cadFindMany.mockReset();
    state.cadFindMany.mockResolvedValue([readyCadFile()]);
  });

  it('accepts a valid HTTP order while ignoring client price, fee, provider, and expiration fields', async () => {
    const response = await request(createApp()).post('/api/v1/orders').send(orderBody());
    expect(response.status).toBe(201);
    expect(response.body.data.totalCost).toBe('$15.00');
    expect(state.dispatchOrder).toHaveBeenCalledOnce();
  });

  it('rejects expired quotes over HTTP before dispatch', async () => {
    state.quote = makeQuote({ validUntil: new Date(Date.now() - 1000).toISOString() });
    const response = await request(createApp()).post('/api/v1/orders').send(orderBody());
    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/expired|invalid/i);
    expect(state.dispatchOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong quote owner', () => { state.quote = makeQuote({ userId: 'user-b' }); return orderBody(); }],
    ['configuration mismatch', () => orderBody({ material: 'ABS' })],
    ['CAD mismatch', () => orderBody({ cadFileIds: ['file-b'] })],
  ])('rejects %s over HTTP', async (_label, buildBody) => {
    const response = await request(createApp()).post('/api/v1/orders').send(buildBody());
    expect(response.status).toBe(409);
    expect(state.dispatchOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['processing', { processingStatus: 'PROCESSING' }],
    ['failed', { processingStatus: 'FAILED', metadata: { geometryStatus: 'UNAVAILABLE', supportLevel: 'FAILED_VALIDATION' } }],
    ['missing metadata', { processingStatus: 'COMPLETE', metadata: null }],
  ])('rejects %s CAD files over HTTP', async (_label, version) => {
    state.cadFindMany.mockResolvedValue([readyCadFile(version)]);
    const response = await request(createApp()).post('/api/v1/orders').send(orderBody());
    expect(response.status).toBe(409);
    expect(state.dispatchOrder).not.toHaveBeenCalled();
  });
});
