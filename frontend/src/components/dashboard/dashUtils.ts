import { CadFile, Order, OrderStatus, Quote } from '../../types';

/**
 * Dashboard domain mappings (single source for counters, badges, recents).
 *
 * Business rules (mirrored server-side where enforced):
 * - Orders derive ONLY from the orders API — never from quotes.
 * - Order statuses are exact backend strings; unknown statuses count toward
 *   the total but earn no dedicated card.
 * - Quote lifecycle mapping preserves backend semantics:
 *   Pending = Draft + Revised (pre-decision, awaiting action),
 *   Expired counts toward the total only.
 */

export type OrderBucket = 'total' | 'inReview' | 'inProduction' | 'quality' | 'delivered';

export interface OrderSummary {
  total: number;
  inReview: number;
  inProduction: number;
  quality: number;
  delivered: number;
}

export function summarizeOrders(orders: Order[]): OrderSummary {
  const count = (status: OrderStatus) => orders.filter((o) => o.status === status).length;
  return {
    total: orders.length,
    inReview: count('In Review'),
    inProduction: count('In Production'),
    quality: count('Quality Inspection'),
    delivered: count('Delivered'),
  };
}

export type QuoteBucket = 'total' | 'ready' | 'pending' | 'approved' | 'rejected';

export interface QuoteSummary {
  total: number;
  ready: number;
  pending: number;
  approved: number;
  rejected: number;
}

export function summarizeQuotes(quotes: Quote[]): QuoteSummary {
  return {
    total: quotes.length,
    ready: quotes.filter((q) => q.status === 'Ready for Approval').length,
    pending: quotes.filter((q) => q.status === 'Draft' || q.status === 'Revised').length,
    approved: quotes.filter((q) => q.status === 'Approved').length,
    rejected: quotes.filter((q) => q.status === 'Rejected').length,
  };
}

/** Customer-side delete eligibility (mirrors the server gate). */
export function isQuoteDeletable(quote: Quote): boolean {
  return !quote.convertedOrderId && quote.status !== 'Approved' && !hasPendingDeletionRequest(quote);
}

/** True when the Quote carries an open PENDING deletion request. */
export function hasPendingDeletionRequest(quote: Quote): boolean {
  const list = (quote as { deletionRequests?: Array<{ status?: string }> }).deletionRequests;
  return Array.isArray(list) && list.some((r) => r?.status === 'PENDING');
}

/** Active customer Quotes only: converted Quotes have left Quotes for Orders
 *  (`convertedOrderId IS NULL` domain rule — never CSS hiding). */
export function activeCustomerQuotes(quotes: Quote[]): Quote[] {
  return quotes.filter((q) => !q.convertedOrderId);
}

export type BadgeTone = 'blue' | 'amber' | 'green' | 'red' | 'purple' | 'gray' | 'cyan';

export function orderBadgeTone(status: OrderStatus): BadgeTone {
  switch (status) {
    case 'In Review':
      return 'amber';
    case 'In Production':
      return 'cyan';
    case 'Quality Inspection':
      return 'purple';
    case 'Delivered':
      return 'green';
    case 'Cancelled':
      return 'red';
    default:
      return 'gray';
  }
}

export function quoteBadgeTone(status: Quote['status']): BadgeTone {
  switch (status) {
    case 'Ready for Approval':
      return 'purple';
    case 'Draft':
    case 'Revised':
      return 'amber';
    case 'Approved':
      return 'green';
    case 'Rejected':
      return 'red';
    case 'Expired':
      return 'gray';
    default:
      return 'gray';
  }
}

export function formatRef(value: string | null | undefined, fallback: string): string {
  return (value || '').trim() || fallback;
}

/** File extension for the engineering placeholder tile (never fabricated). */
export function fileExtension(name: string | null | undefined): string {
  const base = (name || '').trim();
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  const ext = base.slice(dot + 1).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return ext.length >= 2 && ext.length <= 4 ? ext : '';
}

/** Newest-first ordering; falls back to API order when dates are absent. */
export function newestFirst<T extends object>(items: T[]): T[] {
  const stampOf = (item: T): number => {
    const rec = item as { createdAt?: unknown; date?: unknown };
    const raw = typeof rec.createdAt === 'string' ? rec.createdAt : typeof rec.date === 'string' ? rec.date : '';
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  return [...items].sort((a, b) => {
    const da = stampOf(a);
    const db = stampOf(b);
    if (!da || !db) return 0;
    return db - da;
  });
}

export function formatShortDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(locale.startsWith('ar') ? 'ar-EG' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return value;
  }
}

/* ── Dashboard CAD file helpers (pure, tested) ───────────────────────────
 * No `primaryFile` / `mainModel` / `displayOrder` concept exists in the
 * domain model (verified: OrderCadFile is { orderId, cadFileId } with no
 * ordering column; Quote carries only a `cadFileIds` JSON array). Primary
 * selection is therefore deterministic array order:
 * - Orders: first entry of `order.cadFiles` (backend insertion order).
 * - Quotes: first id of the `cadFileIds` JSON array.
 * The choice never re-randomizes between renders. */

export function parseQuoteFileIds(value: Quote['cadFileIds']): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [];
}

/** Full CadFile objects for an order in stable display order. */
export function orderDisplayFiles(order: Order): CadFile[] {
  const entries = Array.isArray(order.cadFiles) ? order.cadFiles : [];
  const files: CadFile[] = [];
  for (const entry of entries) {
    const file = (entry as { cadFile?: CadFile | null })?.cadFile;
    if (file?.id) files.push(file);
  }
  return files;
}

/** Resolve quote files against a by-id map (one GET /cad-files join). */
export function quoteDisplayFiles(quote: Quote, byId: Map<string, CadFile> | Record<string, CadFile>): CadFile[] {
  const ids = parseQuoteFileIds(quote.cadFileIds);
  const files: CadFile[] = [];
  for (const id of ids) {
    const file = byId instanceof Map ? byId.get(id) : byId[id];
    if (file?.id) files.push(file);
  }
  return files;
}

export function primaryDisplayFile(files: CadFile[]): CadFile | null {
  return files.length > 0 ? files[0] : null;
}

/** Deduplicated uppercase extensions in first-seen order (max 3 shown). */
export function dedupExtensions(files: CadFile[]): string[] {
  const seen: string[] = [];
  for (const file of files) {
    const ext = fileExtension(file.name) || String((file as { format?: string }).format || '').toUpperCase();
    if (ext && !seen.includes(ext)) seen.push(ext);
    if (seen.length >= 3) break;
  }
  return seen;
}

/** Overflow count for the stacked badge: files beyond the visible stack. */
export function stackOverflowCount(total: number, visible = 1): number {
  return Math.max(0, total - visible);
}
