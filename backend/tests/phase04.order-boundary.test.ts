import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  quote: null as any,
  dispatchOrder: vi.fn(),
  orderCreate: vi.fn(),
  cadFindMany: vi.fn(),
  profileAddress: '10 Tahrir Square, Cairo, Egypt',
  mfgRequestCreate: vi.fn(async () => ({ id: 'mfg-1' })),
  orderEventCreate: vi.fn(async () => ({ id: 'evt-1' })),
}));

vi.mock('../src/config/database', () => ({
  getPrismaClient: () => ({
    quote: {
      findUnique: vi.fn(async () => state.quote),
      update: vi.fn(async () => state.quote),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    user: {
      findUnique: vi.fn(async () => ({ address: state.profileAddress })),
    },
    cadFile: { findMany: state.cadFindMany, updateMany: vi.fn() },
    order: { create: state.orderCreate, update: vi.fn(async () => ({ id: 'order-1' })) },
    manufacturingRequest: { create: state.mfgRequestCreate },
    orderEvent: { create: state.orderEventCreate },
    manufacturer: { findUnique: vi.fn(async () => ({ id: 'cell-1', companyName: 'CAM LABS Internal Manufacturing Cell' })) },
  }),
}));

vi.mock('../src/providers/manufacturing', () => ({
  getManufacturingEngine: () => ({ dispatchOrder: state.dispatchOrder }),
}));

import { OrdersService } from '../src/services/orders.service';

const makeQuote = (overrides: Record<string, unknown> = {}) => ({
  id: 'quote-1',
  userId: 'user-1',
  partName: 'part.stl',
  technology: 'FDM',
  material: 'PLA',
  quantity: 1,
  toleranceGrade: 'standard',
  surfaceFinish: 'standard',
  manufacturingCost: '$15.00',
  serviceFee: null,
  unitPrice: '$15.00',
  totalPrice: '$15.00',
  leadTime: '24 - 48 Hours',
  validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'Ready for Approval',
  provider: 'CAM LABS',
  providerQuoteRef: 'CAM-QUOTE-1',
  isSimulated: false,
  cadFileIds: ['file-a'],
  ...overrides,
});

const orderRequest = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-1',
  quoteId: 'quote-1',
  partName: 'part.stl',
  technology: 'FDM',
  material: 'PLA',
  quantity: 1,
  totalCost: '$0.01',
  cadFileIds: ['file-a'],
  ...overrides,
}) as any;

const readyCadFile = (overrides: Record<string, unknown> = {}) => ({
  id: 'file-a',
  versions: [{
    processingStatus: 'COMPLETE',
    metadata: { geometryStatus: 'READY', supportLevel: 'FULLY_SUPPORTED', volume: 10, surfaceArea: 20, dimensions: { width: 10, height: 10, depth: 10 } },
    ...overrides,
  }],
});

describe('Phase 04 order trust boundary', () => {
  beforeEach(() => {
    state.quote = makeQuote();
    state.dispatchOrder.mockReset();
    state.dispatchOrder.mockResolvedValue({
      engineName: 'CAM LABS', trackingId: 'CAM-TRK-1', internalOrderRef: 'CAM-ORD-1',
      dispatchedAt: new Date().toISOString(), status: 'Queued', estimatedCompletion: '2026-08-22',
    });
    state.orderCreate.mockReset();
    state.orderCreate.mockResolvedValue({ id: 'order-1', totalCost: '$15.00' });
    state.cadFindMany.mockReset();
    state.cadFindMany.mockResolvedValue([readyCadFile()]);
  });

  it('resolves shipping address from the customer profile and never a fixed placeholder', async () => {
    const order = await OrdersService.createOrder(orderRequest({ shippingAddress: '' }));
    expect(order).not.toBeNull();
    expect(state.dispatchOrder.mock.calls[0][0].shippingAddress).toBe('10 Tahrir Square, Cairo, Egypt');
    const createData = state.orderCreate.mock.calls[0][0].data;
    expect(createData.shippingAddress).toBe('10 Tahrir Square, Cairo, Egypt');
  });

  it('prefers an explicit submitted shipping address over the profile address', async () => {
    const order = await OrdersService.createOrder(orderRequest({ shippingAddress: '15 Sheikh Zayed, Giza' }));
    expect(order).not.toBeNull();
    expect(state.dispatchOrder.mock.calls[0][0].shippingAddress).toBe('15 Sheikh Zayed, Giza');
    expect(state.orderCreate.mock.calls[0][0].data.shippingAddress).toBe('15 Sheikh Zayed, Giza');
  });

  it('never charges a platform service fee: order total equals the quoted price and serviceFee is null', async () => {
    state.quote = makeQuote({ totalPrice: '1,480.00 EGP' });
    const order = await OrdersService.createOrder(orderRequest({ totalCost: '999.00 EGP', serviceFee: '1.00 EGP' }));
    const createData = state.orderCreate.mock.calls[0][0].data;
    expect(createData.totalCost).toBe('1,480.00 EGP');
    expect(createData.serviceFee).toBeNull();
    expect(order).not.toBeNull();
  });

  it('records an in-house manufacturing request and order events (no external provider)', async () => {
    await OrdersService.createOrder(orderRequest());
    expect(state.mfgRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderId: 'order-1', status: 'PENDING', manufacturerId: 'cell-1' }) }),
    );
    const eventTypes = state.orderEventCreate.mock.calls.map((call) => call[0].data.eventType);
    expect(eventTypes).toContain('ORDER_CREATED');
    expect(eventTypes).toContain('MANUFACTURER_ASSIGNED');
  });

  it('rejects client price, fee, provider price, and expiration tampering', async () => {
    const order = await OrdersService.createOrder(orderRequest({ totalCost: '$0.01', serviceFee: '$0.00', providerPrice: '$0.01', validUntil: '2099-01-01' }));
    expect(order).toEqual(expect.objectContaining({ totalCost: '$15.00' }));
    expect(state.dispatchOrder).toHaveBeenCalledOnce();
  });

  it('rejects expired quotes before dispatch', async () => {
    state.quote = makeQuote({ validUntil: new Date(Date.now() - 1000).toISOString() });
    await expect(OrdersService.createOrder(orderRequest())).rejects.toThrow('expired or is invalid');
    expect(state.dispatchOrder).not.toHaveBeenCalled();
  });

  it('rejects ownership, configuration, and CAD mismatches', async () => {
    await expect(OrdersService.createOrder(orderRequest({ userId: 'other-user' }))).rejects.toThrow('does not belong');
    await expect(OrdersService.createOrder(orderRequest({ technology: 'SLA' }))).rejects.toThrow('configuration does not match');
    await expect(OrdersService.createOrder(orderRequest({ cadFileIds: ['file-b'] }))).rejects.toThrow('do not match');
    expect(state.dispatchOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['processing', { processingStatus: 'PROCESSING', metadata: { geometryStatus: 'READY', supportLevel: 'FULLY_SUPPORTED', volume: 10, surfaceArea: 20, dimensions: { width: 10, height: 10, depth: 10 } } }],
    ['failed', { processingStatus: 'FAILED', metadata: { geometryStatus: 'UNAVAILABLE', supportLevel: 'FAILED_VALIDATION' } }],
    ['missing geometry metadata', { processingStatus: 'COMPLETE', metadata: null }],
    ['invalid geometry status', { processingStatus: 'COMPLETE', metadata: { geometryStatus: 'UNAVAILABLE', supportLevel: 'FAILED_VALIDATION', volume: 10, surfaceArea: 20, dimensions: { width: 10, height: 10, depth: 10 } } }],
    ['missing file id result', null],
  ])('rejects %s CAD files before dispatch', async (_label, version) => {
    state.cadFindMany.mockResolvedValue(version ? [readyCadFile(version)] : []);
    await expect(OrdersService.createOrder(orderRequest())).rejects.toThrow(/engineering analysis|belong/);
    expect(state.dispatchOrder).not.toHaveBeenCalled();
  });
});
