import { describe, it, expect } from 'vitest';
import {
  businessReferenceOf,
  parseEgpAmount,
  quotePricingOf,
  shippingInfoOf,
  deliveryInfoOf,
  paymentLabelOf,
  summarizeSpec,
} from './types';

/** Mirrors the production snapshot shape (see quoteSubmission.service). */
const screenshotQuote = (): Record<string, unknown> => ({
  id: 'RFQ-2026-717136',
  reference: 'CAM-2026-177132',
  totalPrice: '1,297.67 EGP',
  shippingMethod: 'STANDARD',
  shippingCostAmount: 70,
  shippingAddressSnapshot: {
    methodCode: 'STANDARD',
    methodName: 'Standard Shipping',
    eta: '2–5 Days',
    feeEgp: 70,
  },
  couponCodeSnapshot: 'CAM20',
  couponDiscountTypeSnapshot: 'PERCENTAGE',
  couponDiscountValueSnapshot: 20,
  couponEligibleAmountSnapshot: 1297.67,
  couponDiscountAmountApplied: 259.534,
  estimatedTotalAmount: 1108.136,
});

describe('businessReferenceOf', () => {
  it('prefers the unified CAM reference over the internal id', () => {
    expect(businessReferenceOf(screenshotQuote())).toBe('CAM-2026-177132');
  });
  it('falls back to the internal id for legacy records without a reference', () => {
    expect(businessReferenceOf({ id: 'RFQ-2026-0001', reference: null })).toBe('RFQ-2026-0001');
  });
  it('returns an em dash when nothing is available', () => {
    expect(businessReferenceOf(null)).toBe('—');
    expect(businessReferenceOf({})).toBe('—');
  });
});

describe('parseEgpAmount', () => {
  it('parses formatted manufacturing totals', () => {
    expect(parseEgpAmount('1,297.67 EGP')).toBe(1297.67);
    expect(parseEgpAmount('70.00 EGP')).toBe(70);
  });
  it('passes numbers through and rejects garbage', () => {
    expect(parseEgpAmount(70)).toBe(70);
    expect(parseEgpAmount(null)).toBeNull();
    expect(parseEgpAmount('—')).toBeNull();
  });
});

describe('quotePricingOf — one authoritative formula', () => {
  it('reproduces the screenshot case: 1297.67 + 70 − 259.534 = 1108.136', () => {
    const p = quotePricingOf(screenshotQuote());
    expect(p.subtotal).toBeCloseTo(1297.67, 2);
    expect(p.shipping).toBe(70);
    expect(p.discount).toBeCloseTo(259.534, 3);
    expect(p.hasCoupon).toBe(true);
    expect(p.couponCode).toBe('CAM20');
    expect(p.estimated).toBeCloseTo(1108.136, 3);
    expect(p.storedEstimated).toBeCloseTo(1108.136, 3);
    expect(p.consistent).toBe(true);
  });

  it('detects the double-shipping presentation as inconsistent', () => {
    // A UI that folds shipping into the subtotal and adds it again yields
    // 1178.14 — that must never match the stored snapshot.
    const p = quotePricingOf(screenshotQuote());
    const doubleCounted = p.subtotal + p.shipping + p.shipping - p.discount;
    expect(doubleCounted).toBeCloseTo(1178.14, 2);
    expect(Math.abs((p.storedEstimated ?? 0) - doubleCounted)).toBeGreaterThan(1);
  });

  it('handles quotes without a coupon', () => {
    const p = quotePricingOf({ totalPrice: '500.00 EGP', shippingCostAmount: 70, couponDiscountAmountApplied: 0, couponCodeSnapshot: null, estimatedTotalAmount: 570 });
    expect(p.hasCoupon).toBe(false);
    expect(p.couponCode).toBeNull();
    expect(p.estimated).toBeCloseTo(570, 2);
    expect(p.consistent).toBe(true);
  });

  it('handles legacy quotes without snapshots', () => {
    const p = quotePricingOf({ totalPrice: '500.00 EGP' });
    expect(p.subtotal).toBe(500);
    expect(p.shipping).toBe(0);
    expect(p.discount).toBe(0);
    expect(p.hasCoupon).toBe(false);
    expect(p.estimated).toBe(500);
    expect(p.storedEstimated).toBeNull();
    expect(p.consistent).toBeNull();
  });
});

describe('shippingInfoOf — historical snapshot, never live records', () => {
  it('reads name/eta/amount from the snapshot', () => {
    const s = shippingInfoOf(screenshotQuote());
    expect(s.name).toBe('Standard Shipping');
    expect(s.eta).toBe('2–5 Days');
    expect(s.amount).toBe(70);
    expect(s.code).toBe('STANDARD');
  });
  it('humanizes legacy enum codes without a snapshot', () => {
    expect(shippingInfoOf({ shippingMethod: 'PRIORITY', shippingCostAmount: 100 }).name).toBe('Priority Shipping');
    expect(shippingInfoOf({}).name).toBe('—');
  });
});

describe('deliveryInfoOf', () => {
  it('returns snapshot fields and nulls for missing optionals', () => {
    const d = deliveryInfoOf({ addressLine1: 'ابو احمد, القصر الملكي', addressLine2: null, city: 'القصر', governorate: 'New Valley', country: 'Egypt', postalCode: '' });
    expect(d.address).toContain('القصر الملكي');
    expect(d.apartment).toBeNull();
    expect(d.postalCode).toBeNull();
    expect(d.country).toBe('Egypt');
  });
});

describe('paymentLabelOf', () => {
  it('labels preferences without implying a charge', () => {
    expect(paymentLabelOf('KASHIER')).toBe('Kashier');
    expect(paymentLabelOf('COD')).toBe('Cash on Delivery');
    expect(paymentLabelOf(null)).toBe('—');
  });
});

describe('summarizeSpec — no false aggregates for mixed parts', () => {
  it('returns the single value when all files agree', () => {
    expect(summarizeSpec(['FDM', 'FDM'])).toBe('FDM');
  });
  it('returns Mixed when priced files disagree', () => {
    expect(summarizeSpec(['FDM', 'SLA'])).toBe('Mixed');
    expect(summarizeSpec(['PLA', 'ABS', 'PLA'])).toBe('Mixed');
  });
  it('returns an em dash when nothing is known', () => {
    expect(summarizeSpec([])).toBe('—');
  });
});
