/** Quote lifecycle statuses recognized by the admin panel. */
export const QUOTE_LIFECYCLE_STATUSES = [
  'Draft',
  'Ready for Approval',
  'Approved',
  'Revised',
  'Rejected',
] as const;

export type QuoteStatusTone = 'review' | 'production' | 'inspection' | 'delivered' | 'cancelled' | 'unknown';

export const QUOTE_TONES: Record<string, QuoteStatusTone> = {
  Draft: 'unknown',
  'Ready for Approval': 'review',
  Approved: 'delivered',
  Revised: 'review',
  Rejected: 'cancelled',
  Expired: 'unknown',
  Converted: 'delivered',
};

/** Mutations mirror the backend gates (requireOperationsAdmin). */
export const canMutateQuote = (role?: string | null): boolean => {
  if (!role) return false;
  if (['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_ADMIN'].includes(role)) return true;
  return role.includes('ADMIN');
};

/** Messaging admits the wider quote-support roles (requireSupportAdmin). */
export const canMessageQuote = (role?: string | null): boolean => {
  if (!role) return false;
  if (['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_ADMIN', 'PRICING_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN'].includes(role)) return true;
  return role.includes('ADMIN');
};

/** Raw CAD record as returned by GET /api/v1/cad-files/:id. */
export interface QuoteCadRecord {
  id: string;
  name: string;
  format: string;
  size?: string | null;
  versions?: Array<{ id: string; version: number; scanStatus?: string; processingStatus?: string }>;
}

/** One priced file inside Quote.pricingBreakdown (multi-file) or synthesized. */
export interface QuoteFileVM {
  fileId: string;
  fileName: string;
  quantity: number;
  material: string;
  process: string;
  perUnitCost?: number | null;
  pricingBreakdown: Record<string, unknown>;
}

export interface QuoteMessageVM {
  id: string;
  message: string;
  subject?: string | null;
  senderId?: string | null;
  createdAt: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Normalize the stored pricingBreakdown into per-file view models.
 * Multi-file quotes carry {files: [...] + sharedSetupCost + ...}; single-file
 * quotes store one PricingBreakdown directly (synthesized into one file row).
 */
export const quoteFilesOf = (quote: Record<string, unknown>): QuoteFileVM[] => {
  const breakdown = asRecord(quote.pricingBreakdown);
  const rawFiles = Array.isArray(breakdown.files) ? breakdown.files : [];
  if (rawFiles.length > 0) {
    return (rawFiles as Record<string, unknown>[]).map((file, index) => ({
      fileId: String(file.fileId || `file-${index}`),
      fileName: String(file.fileName || `File ${index + 1}`),
      quantity: asNumber(file.quantity) ?? 1,
      material: String(file.material || quote.material || '—'),
      process: String(file.process || quote.technology || '—'),
      perUnitCost: asNumber(file.perUnitCost),
      pricingBreakdown: asRecord(file.pricingBreakdown),
    }));
  }
  if (Object.keys(breakdown).length > 0) {
    const cadIds = Array.isArray(quote.cadFileIds) ? (quote.cadFileIds as unknown[]).map(String) : [];
    return [
      {
        fileId: cadIds[0] || 'file-0',
        fileName: String(quote.partName || 'File 1'),
        quantity: asNumber(quote.quantity) ?? 1,
        material: String(quote.material || '—'),
        process: String(quote.technology || '—'),
        perUnitCost: asNumber(breakdown.finalUnitPrice),
        pricingBreakdown: breakdown,
      },
    ];
  }
  return [];
};
/** Total estimated print minutes across all priced files. */
export const totalPrintMinutes = (files: QuoteFileVM[]): number | null => {
  let total = 0;
  let found = false;
  for (const file of files) {
    const machine = asRecord(file.pricingBreakdown.machine);
    const minutes = asNumber(machine.printTimeMinutes);
    if (minutes !== null) {
      total += minutes;
      found = true;
    }
  }
  return found ? total : null;
};

/* ------------------------------------------------------------------ */
/* Unified business reference + authoritative snapshot view-models.     */
/*                                                                     */
/* ONE business reference: Quote.reference / Order.reference (the CAM  */
/* identifier). Internal PKs (RFQ-… ids, UUIDs) are routing-only and   */
/* must never compete with it in business-facing UI.                   */
/*                                                                     */
/* ONE pricing formula, mirroring the server (quoteSubmission.service):*/
/*   Estimated Total = Subtotal + Shipping − Discount                  */
/* where Subtotal = manufacturing total (totalPrice), Shipping = the   */
/* resolved shipping amount, Discount = the applied coupon amount.     */
/* Every pricing surface derives from these snapshot fields so two     */
/* presentations of the same quote can never disagree.                 */
/* ------------------------------------------------------------------ */

/** Business-facing reference; internal id survives only as legacy fallback. */
export const businessReferenceOf = (record: Record<string, unknown> | null | undefined): string => {
  if (!record) return '—';
  const ref = record.reference;
  if (typeof ref === 'string' && ref.trim()) return ref.trim();
  const id = record.id;
  return typeof id === 'string' && id ? id : '—';
};

/** Parse formatted money ("1,297.67 EGP") back to a number; null when absent. */
export const parseEgpAmount = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
};

const asMoney = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return 0;
};

export interface QuotePricingVM {
  /** Manufacturing subtotal (totalPrice), excluding shipping/discount. */
  subtotal: number;
  /** Resolved shipping amount (shippingCostAmount snapshot). */
  shipping: number;
  /** Applied coupon discount (couponDiscountAmountApplied snapshot). */
  discount: number;
  hasCoupon: boolean;
  couponCode: string | null;
  /** Authoritative total: subtotal + shipping − discount. */
  estimated: number;
  /** Stored estimatedTotalAmount snapshot (null for legacy quotes). */
  storedEstimated: number | null;
  /** True when the stored snapshot agrees with the formula (≤ half a cent). */
  consistent: boolean | null;
}

export const quotePricingOf = (quote: Record<string, unknown>): QuotePricingVM => {
  const subtotal = parseEgpAmount(quote.totalPrice) ?? 0;
  const shipping = asMoney(quote.shippingCostAmount);
  const discount = asMoney(quote.couponDiscountAmountApplied);
  const rawCode = quote.couponCodeSnapshot;
  const couponCode = typeof rawCode === 'string' && rawCode.trim() ? rawCode.trim() : null;
  const estimated = Math.max(0, subtotal + shipping - discount);
  const stored = quote.estimatedTotalAmount;
  const storedEstimated = typeof stored === 'number' && Number.isFinite(stored) ? stored : null;
  return {
    subtotal,
    shipping,
    discount,
    hasCoupon: couponCode !== null && discount > 0,
    couponCode,
    estimated,
    storedEstimated,
    consistent: storedEstimated === null ? null : Math.abs(storedEstimated - estimated) < 0.005,
  };
};

const KNOWN_SHIPPING_NAMES: Record<string, string> = {
  STANDARD: 'Standard Shipping',
  PRIORITY: 'Priority Shipping',
  EXPRESS: 'Express Courier',
};

const humanizeCode = (code: string): string => {
  const upper = code.trim().toUpperCase();
  if (KNOWN_SHIPPING_NAMES[upper]) return KNOWN_SHIPPING_NAMES[upper];
  return code
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
};

export interface ShippingInfoVM {
  /** Raw method code (STANDARD, …) — internal detail, shown only as fallback. */
  code: string | null;
  /** Human-readable method name from the historical snapshot. */
  name: string;
  /** Delivery estimate snapshot (ETA). */
  eta: string | null;
  /** Applied shipping amount snapshot (null when never recorded). */
  amount: number | null;
}

/** Historical shipping snapshot — never the live ShippingMethod record. */
export const shippingInfoOf = (quote: Record<string, unknown>): ShippingInfoVM => {
  const snap = asRecord(quote.shippingAddressSnapshot);
  const codeRaw = quote.shippingMethod;
  const code = typeof codeRaw === 'string' && codeRaw.trim() ? codeRaw.trim() : null;
  const snapName = [snap.methodName, snap.methodLabel].find((v) => typeof v === 'string' && (v as string).trim());
  const snapEta = [snap.eta, snap.deliveryEstimate].find((v) => typeof v === 'string' && (v as string).trim());
  const amountRaw = quote.shippingCostAmount;
  return {
    code,
    name: (snapName as string) || (code ? humanizeCode(code) : '—'),
    eta: (snapEta as string) || null,
    amount: typeof amountRaw === 'number' && Number.isFinite(amountRaw) ? amountRaw : null,
  };
};

export interface DeliveryInfoVM {
  address: string | null;
  apartment: string | null;
  city: string | null;
  governorate: string | null;
  country: string | null;
  postalCode: string | null;
}

/** Immutable delivery snapshot taken at submission (never the live profile). */
export const deliveryInfoOf = (quote: Record<string, unknown>): DeliveryInfoVM => {
  const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    address: text(quote.addressLine1),
    apartment: text(quote.addressLine2),
    city: text(quote.city),
    governorate: text(quote.governorate),
    country: text(quote.country),
    postalCode: text(quote.postalCode),
  };
};

/** Preferred (not charged) payment method label. */
export const paymentLabelOf = (preference: unknown): string => {
  const v = typeof preference === 'string' ? preference.trim().toUpperCase() : '';
  if (v === 'COD' || v === 'CASH_ON_DELIVERY' || v === 'CASH') return 'Cash on Delivery';
  if (v === 'KASHIER') return 'Kashier';
  return typeof preference === 'string' && preference.trim() ? preference.trim() : '—';
};

/** Distinct non-empty values, preserving first-seen order. */
export const distinctValues = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  for (const v of values) {
    const s = (v || '').trim();
    if (s && s !== '—' && !seen.has(s)) seen.add(s);
  }
  return [...seen];
};

/** Single value or 'Mixed' when priced files disagree — never a false aggregate. */
export const summarizeSpec = (values: string[]): string => {
  const distinct = distinctValues(values);
  if (distinct.length === 0) return '—';
  if (distinct.length === 1) return distinct[0];
  return 'Mixed';
};
