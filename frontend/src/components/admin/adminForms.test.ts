import { describe, expect, it } from 'vitest';
import { validateShippingForm } from './ShippingMethodForm';
import {
  toApiDateTime,
  toCouponPayload,
  toDateTimeLocalInput,
  validateCouponForm,
} from './CouponForm';

describe('validateShippingForm', () => {
  const valid = {
    code: 'STANDARD',
    name: 'Standard Shipping',
    description: '',
    eta: '2–5 Days',
    priceEgp: 70,
    sortOrder: 0,
    isEnabled: true,
  };

  it('accepts a valid method', () => {
    expect(validateShippingForm(valid)).toEqual({});
  });

  it('rejects bad codes without touching backend rules', () => {
    expect(validateShippingForm({ ...valid, code: 'ab' }).code).toBeTruthy();
    expect(validateShippingForm({ ...valid, code: 'has space' }).code).toBeTruthy();
  });

  it('rejects negative prices and fractional sort orders', () => {
    expect(validateShippingForm({ ...valid, priceEgp: -1 }).priceEgp).toBeTruthy();
    expect(validateShippingForm({ ...valid, sortOrder: 1.5 }).sortOrder).toBeTruthy();
    expect(validateShippingForm({ ...valid, sortOrder: NaN }).sortOrder).toBeTruthy();
  });

  it('enforces backend length limits', () => {
    expect(validateShippingForm({ ...valid, name: 'x' }).name).toBeTruthy();
    expect(validateShippingForm({ ...valid, eta: 'x'.repeat(61) }).eta).toBeTruthy();
  });
});

describe('coupon date helpers', () => {
  it('normalizes datetime-local wall time to full ISO without drift', () => {
    expect(toApiDateTime('2026-09-18T12:30')).toBe('2026-09-18T12:30:00.000Z');
    expect(toApiDateTime('')).toBeNull();
    expect(toApiDateTime('not-a-date')).toBeNull();
  });

  it('loads stored ISO values back to identical wall digits', () => {
    expect(toDateTimeLocalInput('2026-09-18T12:30:00.000Z')).toBe('2026-09-18T12:30');
    expect(toDateTimeLocalInput(null)).toBe('');
    // Round trip is stable: edit-save never shifts the displayed time.
    const wall = toDateTimeLocalInput('2026-09-18T12:30:00.000Z');
    expect(toDateTimeLocalInput(toApiDateTime(wall))).toBe(wall);
  });
});

describe('validateCouponForm', () => {
  const valid = {
    code: 'CAM20',
    discountType: 'PERCENTAGE' as const,
    discountValue: 20,
    maxDiscountAmount: 500 as number | null,
    minQuoteAmount: 1000 as number | null,
    maxTotalUses: 100 as number | null,
    usageLimitPerCustomer: 1 as number | null,
    startAt: '',
    expiresAt: '',
    discountScope: 'SUBTOTAL_ONLY' as const,
  };

  it('accepts a valid coupon', () => {
    expect(validateCouponForm(valid)).toEqual({});
  });

  it('rejects bad codes and out-of-range percentages', () => {
    expect(validateCouponForm({ ...valid, code: 'x' }).code).toBeTruthy();
    expect(validateCouponForm({ ...valid, discountValue: 0 }).discountValue).toBeTruthy();
    expect(validateCouponForm({ ...valid, discountValue: 101 }).discountValue).toBeTruthy();
    // Fixed amounts above 100 are legitimate.
    expect(validateCouponForm({ ...valid, discountType: 'FIXED', discountValue: 250 })).toEqual({});
  });

  it('rejects non-positive usage limits but allows unlimited (null)', () => {
    expect(validateCouponForm({ ...valid, maxTotalUses: 0 }).maxTotalUses).toBeTruthy();
    expect(validateCouponForm({ ...valid, maxTotalUses: null })).toEqual({});
    expect(validateCouponForm({ ...valid, usageLimitPerCustomer: -1 }).usageLimitPerCustomer).toBeTruthy();
  });

  it('rejects expiry at or before start', () => {
    const bad = { ...valid, startAt: '2026-09-18T12:30', expiresAt: '2026-09-18T12:30' };
    expect(validateCouponForm(bad).expiresAt).toBeTruthy();
    const ok = { ...valid, startAt: '2026-09-18T12:30', expiresAt: '2026-09-19T12:30' };
    expect(validateCouponForm(ok)).toEqual({});
  });

  it('builds the exact legacy payload shape (nulls preserved, dates ISO)', () => {
    const payload = toCouponPayload({ ...valid, maxTotalUses: null, startAt: '2026-09-18T12:30' });
    expect(payload).toEqual({
      code: 'CAM20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      maxDiscountAmount: 500,
      minQuoteAmount: 1000,
      maxTotalUses: null,
      usageLimitPerCustomer: 1,
      startAt: '2026-09-18T12:30:00.000Z',
      expiresAt: null,
      discountScope: 'SUBTOTAL_ONLY',
    });
  });
});
