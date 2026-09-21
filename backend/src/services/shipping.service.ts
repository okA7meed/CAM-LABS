import { getPrismaClient } from '../config/database';
import { AppError } from '../utils/errors';

/**
 * Authoritative shipping methods — Super Admin-controlled database records.
 *
 * There are NO hardcoded prices in this module. The seed migration inserts the
 * initial STANDARD / PRIORITY rows, but every price read below comes from the
 * `shipping_methods` table. The frontend fetches enabled methods via
 * GET /api/v1/quotes/shipping-rates and submits only the method CODE; the
 * backend re-resolves the record at final submission, so a price changed
 * mid-checkout (or a manipulated client amount) can never be trusted.
 */

export interface ShippingMethodRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  eta: string;
  priceEgp: number;
  currency: string;
  isEnabled: boolean;
  sortOrder: number;
}

/** Normalize a client-supplied method identifier to a canonical code. */
export function normalizeShippingCode(input: unknown): string {
  const v = String(input || 'STANDARD').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (v === 'PRIORITY_SHIPPING' || v === 'PRIORITY_EXPRESS' || v === 'EXPRESS' || v === 'PRIORITY_COURIER') return 'PRIORITY';
  if (v === 'STANDARD_SHIPPING' || v === 'STANDARD_COURIER') return 'STANDARD';
  return v || 'STANDARD';
}

const toRecord = (row: any): ShippingMethodRecord => ({
  id: String(row.id),
  code: String(row.code),
  name: String(row.name || row.code),
  description: String(row.description || ''),
  eta: String(row.eta || ''),
  priceEgp: Number(row.priceEgp) || 0,
  currency: String(row.currency || 'EGP'),
  isEnabled: Boolean(row.isEnabled),
  sortOrder: Number(row.sortOrder) || 0,
});

/** Currently enabled, non-archived methods in display order (customer selection source). */
export async function getActiveShippingMethods(): Promise<ShippingMethodRecord[]> {
  const prisma = getPrismaClient() as any;
  if (typeof prisma?.shippingMethod?.findMany !== 'function') return [];
  const rows = await prisma.shippingMethod.findMany({
    where: { isEnabled: true, archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return (rows || []).map(toRecord);
}

/**
 * Resolve one method for pricing. Throws when the code is unknown, disabled,
 * or archived — a disabled method is never available for new quotes, and a
 * stale/manipulated client code can never produce a price.
 */
export async function resolveShippingMethod(code: unknown): Promise<ShippingMethodRecord> {
  const prisma = getPrismaClient() as any;
  const wanted = normalizeShippingCode(code);
  if (typeof prisma?.shippingMethod?.findFirst !== 'function') {
    throw new AppError('Shipping configuration is currently unavailable.', 503, 'SHIPPING_UNAVAILABLE');
  }
  const row = await prisma.shippingMethod.findFirst({ where: { code: wanted, archivedAt: null } });
  if (!row || !row.isEnabled) {
    throw new AppError(
      'The selected shipping method is not available. Please choose another method.',
      409,
      'SHIPPING_METHOD_UNAVAILABLE',
    );
  }
  return toRecord(row);
}
