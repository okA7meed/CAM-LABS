import { describe, expect, it } from 'vitest';
import { CadFile, Order, OrderEvent } from '../../types';
import {
  customerVisibleOrderUpdates,
  orderDeliveryInfoOf,
  orderTimelineOf,
  resolveOrderFiles,
  selectedOrderFileSpecs,
} from './orderWorkspaceUtils';

const cad = (id: string, name: string, extra: Partial<CadFile> = {}): CadFile =>
  ({ id, name, format: 'STL', size: '1.00 MB', dimensions: '25.000 × 30.000 × 15.000 mm', ...extra }) as CadFile;

const order = (extra: Partial<Order> & Record<string, unknown> = {}): Order =>
  ({
    id: 'CAM-2026-0001',
    reference: 'CAM-2026-000001',
    partName: 'Main Housing',
    technology: 'SLS',
    material: 'PA12 (Nylon)',
    quantity: 4,
    date: '2026-09-18',
    estDelivery: '2026-09-28',
    status: 'In Production',
    totalCost: '1,250.00 EGP',
    tolerance: '±0.15 mm (ISO 2768-m)',
    history: [],
    ...extra,
  }) as unknown as Order;

describe('resolveOrderFiles', () => {
  it('resolves files from embedded cadFiles joined with catalog records', () => {
    const o = order({
      cadFiles: [
        { cadFileId: 'f1', cadFile: cad('f1', 'Housing_v1.stl'), configuration: { quantity: 2, material: 'PA12' } },
        { cadFileId: 'f2', cadFile: cad('f2', 'Bracket.step'), configuration: { quantity: 1 } },
      ],
    });
    const byId = new Map([
      ['f1', cad('f1', 'Housing_Catalog.stl')],
      ['f2', cad('f2', 'Bracket.step')],
    ]);

    const files = resolveOrderFiles(o, byId);
    expect(files).toHaveLength(2);
    expect(files[0].fileId).toBe('f1');
    expect(files[0].name).toBe('Housing_Catalog.stl');
    expect(files[0].quantity).toBe(2);
    expect(files[1].name).toBe('Bracket.step');
    expect(files[1].quantity).toBe(1);
  });

  it('falls back to cadFileIds when cadFiles array is empty', () => {
    const o = order({
      cadFileIds: ['f10', 'f20'],
      cadFiles: [],
    });
    const byId = new Map([['f10', cad('f10', 'PartA.stl')]]);
    const files = resolveOrderFiles(o, byId);
    expect(files).toHaveLength(2);
    expect(files[0].name).toBe('PartA.stl');
    expect(files[1].name).toBe('f20');
  });

  it('returns empty array when order has no files', () => {
    expect(resolveOrderFiles(order(), new Map())).toEqual([]);
  });
});

describe('selectedOrderFileSpecs', () => {
  it('extracts specifications without adding Total Price (Selected File)', () => {
    const o = order({
      material: 'Nylon PA12',
      technology: 'SLS',
      tolerance: '±0.1 mm',
      surfaceFinish: 'Standard Bead Blasted',
      cadFiles: [
        {
          cadFileId: 'f1',
          cadFile: cad('f1', 'Plate.stl'),
          configuration: {
            quantity: 3,
            unitPrice: '150.00 EGP',
            layerHeight: '0.12 mm',
            infill: '100%',
            color: 'Black',
          },
        },
      ],
    });
    const [file] = resolveOrderFiles(o, new Map([['f1', cad('f1', 'Plate.stl')]]));
    const specs = selectedOrderFileSpecs(file, o, null);

    const byKey = Object.fromEntries(specs.map((s) => [s.key, s.value]));
    expect(byKey.material).toBe('Nylon PA12');
    expect(byKey.technology).toBe('SLS');
    expect(byKey.quantity).toBe('3 pcs');
    expect(byKey.dimensions).toBe('25.000 × 30.000 × 15.000 mm');
    expect(byKey.layer).toBe('0.12 mm');
    expect(byKey.infill).toBe('100%');
    expect(byKey.color).toBe('Black');
    expect(byKey.unitPrice).toBe('150.00 EGP');
    expect(byKey.finish).toBe('Standard Bead Blasted');
    // Must NOT contain Total Price (Selected File)
    expect(specs.some((s) => s.key === 'lineTotal' || s.key === 'totalPrice')).toBe(false);
  });

  it('uses live geometry dimensions when available', () => {
    const o = order({
      cadFiles: [{ cadFileId: 'f1', cadFile: cad('f1', 'Plate.stl') }],
    });
    const [file] = resolveOrderFiles(o, new Map([['f1', cad('f1', 'Plate.stl')]]));
    const specs = selectedOrderFileSpecs(file, o, { width: 50.5, height: 40.2, depth: 12.0 });
    expect(specs.find((s) => s.key === 'dimensions')?.value).toBe('50.50 × 40.20 × 12.00 mm');
  });
});

describe('orderDeliveryInfoOf', () => {
  it('extracts structured address from shippingAddressSnapshot', () => {
    const o = order({
      shippingAddressSnapshot: {
        recipientName: 'Ahmed Omar',
        phone: '+20 100 123 4567',
        governorate: 'Cairo',
        city: 'New Cairo',
        street: 'Street 90',
        building: 'Building 4B',
        methodName: 'Express Courier',
        eta: '3 business days',
        deliveryNotes: 'Call upon arrival',
      },
    });
    const delivery = orderDeliveryInfoOf(o);
    expect(delivery.recipient).toBe('Ahmed Omar');
    expect(delivery.phone).toBe('+20 100 123 4567');
    expect(delivery.governorate).toBe('Cairo');
    expect(delivery.city).toBe('New Cairo');
    expect(delivery.fullAddress).toBe('Building 4B, Street 90, New Cairo, Cairo');
    expect(delivery.method).toBe('Express Courier');
    expect(delivery.estimated).toBe('2026-09-28');
    expect(delivery.notes).toBe('Call upon arrival');
  });

  it('falls back cleanly when snapshots are missing', () => {
    const o = order({
      shippingAddress: '123 Nile St, Giza',
    });
    const delivery = orderDeliveryInfoOf(o, { name: 'Fall Back User', phone: '+2011111111' } as any);
    expect(delivery.recipient).toBe('Fall Back User');
    expect(delivery.phone).toBe('+2011111111');
    expect(delivery.fullAddress).toBe('123 Nile St, Giza');
    expect(delivery.notes).toBeNull();
  });
});

describe('customerVisibleOrderUpdates', () => {
  const evt = (extra: Partial<OrderEvent>): OrderEvent =>
    ({ id: `e-${Math.random()}`, orderId: 'CAM-1', description: '', createdAt: '2026-09-19T10:00:00Z', ...extra }) as OrderEvent;

  it('exposes only server-generated operational events, newest first, max 3', () => {
    const updates = customerVisibleOrderUpdates(
      [
        evt({ id: 'e-old', eventType: 'ORDER_CREATED', createdAt: '2026-09-18T10:00:00Z' }),
        evt({ id: 'e-new', eventType: 'STATUS_UPDATE', metadata: { to: 'In Production' } as never, createdAt: '2026-09-19T14:00:00Z' }),
      ],
    );
    expect(updates).toHaveLength(2);
    expect(updates[0].id).toBe('e-new');
    expect(updates[0].labelKey).toBe('orderdetail.mfgEventStatus');
    expect(updates[0].statusKey).toBe('order.status.inProduction');
    expect(updates[1].labelKey).toBe('orderdetail.mfgEventCreated');
  });

  it('never exposes admin notes, price history, routing, or messages', () => {
    const updates = customerVisibleOrderUpdates([
      evt({ eventType: 'ORDER_APPROVED', description: 'Order approved for production. Internal: rush at cost.' }),
      evt({ eventType: 'PRICE_UPDATED', description: 'Order price updated from 100 to 90.' }),
      evt({ eventType: 'MANUFACTURER_ASSIGNED', description: 'Manufacturing assigned to InternalPlant.' }),
      evt({ eventType: 'CUSTOMER_MESSAGE', description: 'Your parts shipped.' }),
    ]);
    expect(updates).toEqual([]);
  });

  it('falls back to raw status text for unknown targets and skips empty ones', () => {
    const updates = customerVisibleOrderUpdates([
      evt({ id: 'e-x', eventType: 'STATUS_UPDATE', metadata: { to: 'Future State' } as never }),
      evt({ id: 'e-empty', eventType: 'STATUS_UPDATE', metadata: {} as never }),
    ]);
    expect(updates).toHaveLength(1);
    expect(updates[0].statusKey).toBeUndefined();
    expect(updates[0].statusFallback).toBe('Future State');
  });

  it('returns empty for missing event lists', () => {
    expect(customerVisibleOrderUpdates(undefined)).toEqual([]);
  });
});

describe('orderTimelineOf', () => {
  it('maps stages properly for In Production order', () => {
    const o = order({
      status: 'In Production',
      createdAt: '2026-09-18T10:00:00Z',
      events: [
        { id: 'e1', orderId: 'CAM-1', eventType: 'STATUS_UPDATE', description: 'Moved to production', metadata: { to: 'In Production' }, createdAt: '2026-09-19T14:00:00Z' },
      ],
    });
    const timeline = orderTimelineOf(o);
    expect(timeline).toHaveLength(4);
    expect(timeline[0].key).toBe('In Review');
    expect(timeline[0].state).toBe('done');
    expect(timeline[1].key).toBe('In Production');
    expect(timeline[1].state).toBe('active');
    expect(timeline[1].at).toBe('2026-09-19T14:00:00Z');
    expect(timeline[2].key).toBe('Quality Inspection');
    expect(timeline[2].state).toBe('pending');
    expect(timeline[3].key).toBe('Delivered');
    expect(timeline[3].state).toBe('pending');
  });

  it('handles Cancelled status cleanly', () => {
    const o = order({
      status: 'Cancelled',
      createdAt: '2026-09-18T10:00:00Z',
      events: [
        { id: 'e2', orderId: 'CAM-1', eventType: 'CANCELLED', description: 'Customer cancelled', createdAt: '2026-09-18T12:00:00Z' },
      ],
    });
    const timeline = orderTimelineOf(o);
    expect(timeline).toHaveLength(2);
    expect(timeline[0].state).toBe('done');
    expect(timeline[1].key).toBe('cancelled');
    expect(timeline[1].state).toBe('error');
    expect(timeline[1].at).toBe('2026-09-18T12:00:00Z');
  });
});
