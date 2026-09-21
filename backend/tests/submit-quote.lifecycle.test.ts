import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Submit Quote lifecycle + coupons + unified reference invariants.
 * Uses mocked Prisma to prove server-authoritative behavior without a live DB.
 */

const state = vi.hoisted(() => {
  const couponBase = {
    id: 'coupon-1',
    code: 'CAM20',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    maxDiscountAmount: 500,
    minQuoteAmount: 1000,
    maxTotalUses: 100,
    usageLimitPerCustomer: 1,
    startAt: null,
    expiresAt: null,
    isEnabled: true,
    discountScope: 'SUBTOTAL_ONLY',
    appliesToShipping: false,
    totalUses: 47,
    archivedAt: null,
  };
  let coupon: any = { ...couponBase };
  let usageCountTotal = 47;
  let usageCountMine = 0;

  const prisma: any = {
    user: {
      findUnique: vi.fn(async () => ({ id: 'u-1', name: 'Test Customer', email: 't@example.com' })),
      update: vi.fn(async ({ data }: any) => ({ ...data })),
    },
    quote: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => ({ ...data })),
    },
    order: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => ({ ...data })),
    },
    shippingMethod: {
      findMany: vi.fn(async () => [
        { id: 'sm-standard', code: 'STANDARD', name: 'Standard Shipping', description: 'Reliable delivery within 2 to 5 business days', eta: '2–5 Days', priceEgp: 70, currency: 'EGP', isEnabled: true, sortOrder: 0 },
        { id: 'sm-priority', code: 'PRIORITY', name: 'Priority Shipping', description: 'Expedited handling and courier dispatch', eta: '1–2 Days', priceEgp: 100, currency: 'EGP', isEnabled: true, sortOrder: 1 },
      ]),
      findFirst: vi.fn(async ({ where }: any) => {
        const rows: Record<string, any> = {
          STANDARD: { id: 'sm-standard', code: 'STANDARD', name: 'Standard Shipping', description: '', eta: '2–5 Days', priceEgp: 70, currency: 'EGP', isEnabled: true, sortOrder: 0 },
          PRIORITY: { id: 'sm-priority', code: 'PRIORITY', name: 'Priority Shipping', description: '', eta: '1–2 Days', priceEgp: 100, currency: 'EGP', isEnabled: true, sortOrder: 1 },
        };
        return rows[where?.code] || null;
      }),
    },
    coupon: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.code === coupon.code || where.id === coupon.id) return { ...coupon };
        return null;
      }),
      update: vi.fn(async ({ data }: any) => {
        coupon = { ...coupon, totalUses: (coupon.totalUses || 0) + 1, ...data };
        usageCountTotal += 1;
        return { ...coupon };
      }),
      updateMany: vi.fn(async ({ where }: any) => {
        // Concurrency-safe claim: only succeeds when under cap.
        if (coupon.maxTotalUses != null && usageCountTotal >= Number(coupon.maxTotalUses)) return { count: 0 };
        usageCountTotal += 1;
        coupon = { ...coupon, totalUses: usageCountTotal };
        return { count: 1 };
      }),
    },
    couponUsage: {
      count: vi.fn(async ({ where }: any) => {
        if (where?.userId) return usageCountMine;
        return usageCountTotal;
      }),
      create: vi.fn(async ({ data }: any) => {
        usageCountMine += 1;
        return { id: 'usage-1', createdAt: new Date(), ...data };
      }),
      findMany: vi.fn(async () => []),
    },
  };

  return {
    couponBase,
    get coupon() {
      return coupon;
    },
    set coupon(v: any) {
      coupon = v;
    },
    get usageCountTotal() {
      return usageCountTotal;
    },
    set usageCountTotal(v: number) {
      usageCountTotal = v;
    },
    get usageCountMine() {
      return usageCountMine;
    },
    set usageCountMine(v: number) {
      usageCountMine = v;
    },
    prisma,
  };
});

vi.mock('../src/config/database', () => ({
  getPrismaClient: () => ({
    ...state.prisma,
    $transaction: async (fn: (tx: unknown) => unknown) => fn(state.prisma),
  }),
}));

import { CouponsService } from '../src/services/coupons.service';
import { BusinessReferenceService } from '../src/services/businessReference.service';
import { getActiveShippingMethods, normalizeShippingCode, resolveShippingMethod } from '../src/services/shipping.service';
import { GOVERNORATES, QuoteSubmissionService } from '../src/services/quoteSubmission.service';
import { QuotesService } from '../src/services/quotes.service';

describe('Submit Quote invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.coupon = { ...state.couponBase };
    state.usageCountTotal = 47;
    state.usageCountMine = 0;
  });

  it('AUTH: coupon validation requires an authenticated customer', async () => {
    await expect(
      CouponsService.validateForQuote({ code: 'CAM20', userId: '', subtotalAmount: 1000 }),
    ).rejects.toMatchObject({ code: 'COUPON_AUTH_REQUIRED' });
  });

  it('DISCOUNT: valid percentage coupon applies with max cap', async () => {
    // 20% of 1000 = 200 (under 500 cap)
    const r1 = await CouponsService.validateForQuote({ code: 'CAM20', userId: 'u-1', subtotalAmount: 1000 });
    expect(r1.discountAmount).toBe(200);
    // 20% of 5000 = 1000 → capped at 500
    const r2 = await CouponsService.validateForQuote({ code: 'CAM20', userId: 'u-1', subtotalAmount: 5000 });
    expect(r2.discountAmount).toBe(500);
  });

  it('DISCOUNT: invalid code rejected', async () => {
    await expect(
      CouponsService.validateForQuote({ code: 'NOPE', userId: 'u-1', subtotalAmount: 2000 }),
    ).rejects.toMatchObject({ code: 'COUPON_INVALID' });
  });

  it('DISCOUNT: disabled coupon rejected', async () => {
    state.coupon = { ...state.coupon, isEnabled: false };
    await expect(
      CouponsService.validateForQuote({ code: 'CAM20', userId: 'u-1', subtotalAmount: 2000 }),
    ).rejects.toMatchObject({ code: 'COUPON_DISABLED' });
  });

  it('DISCOUNT: scheduled coupon rejected before start', async () => {
    state.coupon = { ...state.coupon, startAt: new Date(Date.now() + 3600_000) };
    await expect(
      CouponsService.validateForQuote({ code: 'CAM20', userId: 'u-1', subtotalAmount: 2000 }),
    ).rejects.toMatchObject({ code: 'COUPON_SCHEDULED' });
  });

  it('DISCOUNT: expired coupon rejected', async () => {
    state.coupon = { ...state.coupon, expiresAt: new Date(Date.now() - 1000) };
    await expect(
      CouponsService.validateForQuote({ code: 'CAM20', userId: 'u-1', subtotalAmount: 2000 }),
    ).rejects.toMatchObject({ code: 'COUPON_EXPIRED' });
  });

  it('DISCOUNT: minimum quote amount enforced', async () => {
    await expect(
      CouponsService.validateForQuote({ code: 'CAM20', userId: 'u-1', subtotalAmount: 500 }),
    ).rejects.toMatchObject({ code: 'COUPON_MIN_AMOUNT' });
  });

  it('DISCOUNT: global maximum usage enforced', async () => {
    state.usageCountTotal = 100;
    await expect(
      CouponsService.validateForQuote({ code: 'CAM20', userId: 'u-1', subtotalAmount: 2000 }),
    ).rejects.toMatchObject({ code: 'COUPON_USAGE_LIMIT' });
  });

  it('DISCOUNT: per-customer limit enforced', async () => {
    state.usageCountMine = 1;
    await expect(
      CouponsService.validateForQuote({ code: 'CAM20', userId: 'u-1', subtotalAmount: 2000 }),
    ).rejects.toMatchObject({ code: 'COUPON_CUSTOMER_LIMIT' });
  });

  it('DISCOUNT: fixed-amount coupon never exceeds eligible amount', async () => {
    state.coupon = { ...state.coupon, discountType: 'FIXED', discountValue: 100, maxDiscountAmount: null, minQuoteAmount: 0 };
    const r = await CouponsService.validateForQuote({ code: 'CAM20', userId: 'u-1', subtotalAmount: 60 });
    expect(r.discountAmount).toBe(60);
  });

  it('DISCOUNT: subtotal-only scope ignores shipping', async () => {
    state.coupon = { ...state.coupon, minQuoteAmount: 0 };
    const r = await CouponsService.validateForQuote({ code: 'CAM20', userId: 'u-1', subtotalAmount: 1000, shippingAmount: 70 });
    expect(r.eligibleAmount).toBe(1000);
    expect(r.discountAmount).toBe(200);
  });

  it('CONCURRENCY: last-use race allows exactly one winner', async () => {
    state.coupon = { ...state.coupon, minQuoteAmount: 0, usageLimitPerCustomer: null };
    state.usageCountTotal = 99;
    const tx: any = {
      coupon: {
        findUnique: state.prisma.coupon.findUnique,
        updateMany: state.prisma.coupon.updateMany,
        update: state.prisma.coupon.update,
      },
      couponUsage: state.prisma.couponUsage,
    };
    // First concurrent submit consumes use #100.
    await CouponsService.consumeInTransaction(tx, {
      code: 'CAM20',
      userId: 'u-1',
      quoteId: 'q-1',
      eligibleAmount: 2000,
      discountAmount: 400,
      amountAfterDiscount: 1600,
    });
    // Second concurrent submit must fail (cap reached).
    await expect(
      CouponsService.consumeInTransaction(tx, {
        code: 'CAM20',
        userId: 'u-2',
        quoteId: 'q-2',
        eligibleAmount: 2000,
        discountAmount: 400,
        amountAfterDiscount: 1600,
      }),
    ).rejects.toMatchObject({ code: 'COUPON_USAGE_LIMIT' });
  });

  it('STATUS: effective status derives scheduled/expired/limit without stored redundancy', () => {
    expect(CouponsService.effectiveStatus({ ...state.couponBase, isEnabled: true, startAt: new Date(Date.now() + 10000) })).toBe('Scheduled');
    expect(CouponsService.effectiveStatus({ ...state.couponBase, expiresAt: new Date(Date.now() - 1000) })).toBe('Expired');
    expect(CouponsService.effectiveStatus({ ...state.couponBase, maxTotalUses: 100 }, 100)).toBe('Usage Limit Reached');
    expect(CouponsService.effectiveStatus({ ...state.couponBase, isEnabled: false })).toBe('Inactive');
    expect(CouponsService.effectiveStatus({ ...state.couponBase })).toBe('Active');
  });

  it('REFERENCE: unified reference is server-generated CAM-2026-###### and unique-shaped', async () => {
    const a = await BusinessReferenceService.generateUniqueReference();
    const b = await BusinessReferenceService.generateUniqueReference();
    expect(a).toMatch(/^CAM-2026-\d{6}$/);
    expect(b).toMatch(/^CAM-2026-\d{6}$/);
    // Uniqueness is enforced by DB constraint + pre-check; format never comes from the client.
  });

  it('SHIPPING: methods come from Super Admin-controlled database records (no hardcoded prices)', async () => {
    const methods = await getActiveShippingMethods();
    expect(methods).toHaveLength(2);
    expect(methods[0]).toMatchObject({ code: 'STANDARD', priceEgp: 70 });
    expect(methods[1]).toMatchObject({ code: 'PRIORITY', priceEgp: 100 });
    // Source module exposes no price constants anymore.
    const serviceSource = await import('../src/services/shipping.service');
    expect((serviceSource as any).STANDARD_SHIPPING_FEE_EGP).toBeUndefined();
    expect((serviceSource as any).SHIPPING_RATES).toBeUndefined();
  });

  it('SHIPPING: resolveShippingMethod revalidates the current record and ignores client amounts', async () => {
    const standard = await resolveShippingMethod('STANDARD');
    expect(standard.priceEgp).toBe(70);
    // Legacy aliases still normalize to canonical codes.
    expect((await resolveShippingMethod('priority_shipping')).code).toBe('PRIORITY');
    expect(normalizeShippingCode(' express ')).toBe('PRIORITY');
    // Unknown codes are rejected, never priced.
    await expect(resolveShippingMethod('OVERNIGHT')).rejects.toMatchObject({ code: 'SHIPPING_METHOD_UNAVAILABLE' });
  });

  it('SHIPPING: disabled methods are unavailable for new quotes', async () => {
    const findFirst = state.prisma.shippingMethod.findFirst;
    findFirst.mockResolvedValueOnce({ id: 'sm-x', code: 'STANDARD', name: 'Standard', description: '', eta: '', priceEgp: 70, currency: 'EGP', isEnabled: false, sortOrder: 0 });
    await expect(resolveShippingMethod('STANDARD')).rejects.toMatchObject({ code: 'SHIPPING_METHOD_UNAVAILABLE' });
  });

  it('GOVERNORATES: business list contains all 29 required options', () => {
    expect(GOVERNORATES).toHaveLength(29);
    for (const required of ['6th of October', 'Cairo', 'Giza', 'Alexandria', 'Suez']) {
      expect(GOVERNORATES).toContain(required);
    }
  });

  it('SNAPSHOT: submit persists estimatedTotal = subtotal + shipping − discount (no double count)', async () => {
    // Mirrors the production screenshot case: S=1297.67, H=70, CAM20 20% → D=259.534.
    const calc = vi.spyOn(QuotesService, 'calculateMultiFileQuotation').mockResolvedValue({
      quoteId: 'CAM-QT-1',
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      files: [],
      manufacturingSubtotal: 1297.67,
      quantityDiscountSavings: 0,
      setupCost: 0,
      pricingBreakdown: {},
      totalCustomerPrice: 1297.67,
      leadTime: '3 days',
      leadTimeDays: 3,
      currency: 'EGP',
      validFor14Days: true,
      formattedManufacturingSubtotal: '1,297.67 EGP',
      formattedTotalPrice: '1,297.67 EGP',
      formattedCurrency: 'EGP',
    } as never);
    try {
      const { quote } = await QuoteSubmissionService.submit({
        userId: 'u-1',
        partName: 'bracket.stl',
        technology: 'FDM',
        material: 'PLA',
        quantity: 1,
        files: [{ fileId: 'file-a' }],
        contact: { fullName: 'Test Customer', email: 't@example.com', phone: '+201012345678' },
        delivery: { country: 'Egypt', governorate: 'Cairo', city: 'Cairo', address: '10 Tahrir Square' },
        shippingMethod: 'STANDARD',
        preferredPaymentMethod: 'KASHIER',
        billingSameAsShipping: true,
        couponCode: 'CAM20',
      });
      expect(quote.reference).toMatch(/^CAM-2026-\d{6}$/);
      expect(quote.shippingMethod).toBe('STANDARD');
      expect(quote.shippingCostAmount).toBe(70);
      expect(quote.couponCodeSnapshot).toBe('CAM20');
      expect(quote.couponDiscountAmountApplied).toBeCloseTo(259.534, 3);
      // The authoritative invariant every UI must reproduce:
      // estimatedTotalAmount = subtotal + shipping − discount.
      expect(quote.estimatedTotalAmount).toBeCloseTo(1297.67 + 70 - 259.534, 2);
      expect(quote.estimatedTotalAmount).toBeCloseTo(1108.14, 2);
      // A presentation that folds shipping into the subtotal and adds it
      // again (1178.14) can never match the stored snapshot.
      expect(Math.abs(quote.estimatedTotalAmount - 1178.14)).toBeGreaterThan(1);
      // Submit creates a quote row only — never an order.
      expect(state.prisma.order.create).not.toHaveBeenCalled();
    } finally {
      calc.mockRestore();
    }
  });
});
