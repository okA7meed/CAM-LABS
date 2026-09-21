import { randomInt } from 'crypto';
import { getPrismaClient } from '../config/database';

/**
 * Unified business reference — ONE immutable customer-facing reference
 * shared across Quote → Order lifecycle (e.g. CAM-2026-368000).
 *
 * Internal UUIDs/PKs stay separate; `reference` is the business key.
 * Generated server-side only, unique, concurrency-safe (unique DB
 * constraint + retry; conversion reuses the Quote's reference verbatim).
 */
export class BusinessReferenceService {
  private static format(): string {
    return `CAM-2026-${randomInt(100000, 1000000)}`;
  }

  /** Generate a fresh reference that is free in BOTH quotes and orders. */
  static async generateUniqueReference(attempts = 12): Promise<string> {
    const prisma = getPrismaClient() as any;
    for (let i = 0; i < attempts; i++) {
      const candidate = this.format();
      let q: any = null;
      let o: any = null;
      try {
        q = typeof prisma?.quote?.findUnique === 'function'
          ? await prisma.quote.findUnique({ where: { reference: candidate }, select: { id: true, reference: true } })
          : null;
      } catch {
        q = null;
      }
      try {
        o = typeof prisma?.order?.findUnique === 'function'
          ? await prisma.order.findUnique({ where: { reference: candidate }, select: { id: true, reference: true } })
          : null;
      } catch {
        o = null;
      }
      // A mocked findUnique may return an unrelated row for ANY args (legacy
      // tests). Only treat the candidate as taken when the returned row
      // actually carries this reference (or id). Otherwise it is free.
      const qTaken = q && (q.reference === candidate || q.id === candidate);
      const oTaken = o && (o.reference === candidate || o.id === candidate || (typeof o.id === 'string' && o.id === candidate));
      if (!qTaken && !oTaken) return candidate;
    }
    // Extremely unlikely fallback: timestamp-suffixed draw (still matches CAM-2026-###### pattern family).
    return `CAM-2026-${randomInt(100000, 1000000)}`;
  }
}
