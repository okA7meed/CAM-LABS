import { describe, expect, it } from 'vitest';
import { CadFile, Order, Quote } from '../../types';
import {
  activeCustomerQuotes,
  dedupExtensions,
  hasPendingDeletionRequest,
  isQuoteDeletable,
  newestFirst,
  orderBadgeTone,
  orderDisplayFiles,
  parseQuoteFileIds,
  primaryDisplayFile,
  quoteBadgeTone,
  quoteDisplayFiles,
  stackOverflowCount,
  summarizeOrders,
  summarizeQuotes,
} from './dashUtils';

const order = (status: Order['status']): Order =>
  ({
    id: `o-${status}`,
    partName: 'Bracket',
    status,
    date: '2026-09-01',
    estDelivery: '2026-09-10',
    totalCost: '100 EGP',
    quantity: 1,
    technology: 'FDM',
    material: 'PLA',
    progressStep: 1,
    tolerance: 'std',
    history: [],
  }) as unknown as Order;

const quote = (status: Quote['status'], extra: Partial<Quote> = {}): Quote =>
  ({
    id: `q-${status}-${Math.random()}`,
    partName: 'Bracket',
    technology: 'FDM',
    material: 'PLA',
    quantity: 1,
    leadTime: '5 days',
    unitPrice: '10',
    totalPrice: '10 EGP',
    validUntil: '2026-10-01',
    status,
    convertedOrderId: null,
    ...extra,
  }) as Quote;

describe('dashboard summaries', () => {
  it('counts orders by exact backend status only', () => {
    const summary = summarizeOrders([
      order('In Review'),
      order('In Review'),
      order('In Production'),
      order('Quality Inspection'),
      order('Delivered'),
      order('Cancelled'),
    ]);
    expect(summary).toEqual({ total: 6, inReview: 2, inProduction: 1, quality: 1, delivered: 1 });
  });

  it('maps quote lifecycle preserving business semantics', () => {
    const summary = summarizeQuotes([
      quote('Draft'),
      quote('Revised'),
      quote('Ready for Approval'),
      quote('Ready for Approval'),
      quote('Approved'),
      quote('Rejected'),
      quote('Expired'),
    ]);
    // Pending = Draft + Revised; Expired counts toward the total only.
    expect(summary).toEqual({ total: 7, ready: 2, pending: 2, approved: 1, rejected: 1 });
  });

  it('never derives order counts from quotes', () => {
    expect(summarizeOrders([]).total).toBe(0);
    expect(summarizeQuotes([quote('Ready for Approval')]).total).toBe(1);
  });
});

describe('quote delete eligibility', () => {
  it('allows unconverted non-approved quotes only', () => {
    expect(isQuoteDeletable(quote('Draft'))).toBe(true);
    expect(isQuoteDeletable(quote('Ready for Approval'))).toBe(true);
    expect(isQuoteDeletable(quote('Rejected'))).toBe(true);
    expect(isQuoteDeletable(quote('Approved'))).toBe(false);
    expect(isQuoteDeletable(quote('Ready for Approval', { convertedOrderId: 'order-1' }))).toBe(false);
  });

  it('blocks repeat requests while one is pending', () => {
    const pending = quote('Ready for Approval', {
      deletionRequests: [{ id: 'r-1', status: 'PENDING', requestedAt: new Date().toISOString() }],
    });
    expect(hasPendingDeletionRequest(pending)).toBe(true);
    expect(isQuoteDeletable(pending)).toBe(false);
    expect(hasPendingDeletionRequest(quote('Ready for Approval'))).toBe(false);
  });

  it('converted quotes leave the active customer list', () => {
    const list = [
      quote('Ready for Approval'),
      quote('Ready for Approval', { convertedOrderId: 'order-1' }),
      quote('Approved', { convertedOrderId: 'order-2' }),
    ];
    expect(activeCustomerQuotes(list)).toHaveLength(1);
  });
});

describe('badge tones', () => {
  it('assigns stable tones per status', () => {
    expect(orderBadgeTone('In Review')).toBe('amber');
    expect(orderBadgeTone('Delivered')).toBe('green');
    expect(quoteBadgeTone('Ready for Approval')).toBe('purple');
    expect(quoteBadgeTone('Rejected')).toBe('red');
  });
});

describe('newest-first ordering', () => {
  it('keeps API order when dates are absent', () => {
    const items = [{ a: 1 }, { a: 2 }];
    expect(newestFirst(items)).toEqual(items);
  });
});

const cad = (id: string, name: string): CadFile =>
  ({ id, name, format: name.split('.').pop()?.toUpperCase() || 'STL' }) as unknown as CadFile;

describe('dashboard CAD file helpers', () => {
  it('parses quote cadFileIds deterministically', () => {
    expect(parseQuoteFileIds(['a', 'b'])).toEqual(['a', 'b']);
    expect(parseQuoteFileIds(undefined)).toEqual([]);
    expect(parseQuoteFileIds(null as unknown as undefined)).toEqual([]);
    expect(parseQuoteFileIds('nope' as unknown as string[])).toEqual([]);
  });

  it('selects the primary file by stable array order (never random)', () => {
    const files = [cad('1', 'Bracket.STL'), cad('2', 'Cover.STEP'), cad('3', 'Housing.STL')];
    expect(primaryDisplayFile(files)?.id).toBe('1');
    expect(primaryDisplayFile([])).toBeNull();
    // Repeated selection is stable.
    expect(primaryDisplayFile(files)?.id).toBe('1');
  });

  it('reads order files in embedded order', () => {
    const o = {
      cadFiles: [{ cadFileId: '2', cadFile: cad('2', 'Cover.STEP') }, { cadFileId: '1', cadFile: cad('1', 'A.STL') }],
    } as unknown as Order;
    expect(orderDisplayFiles(o).map((f) => f.id)).toEqual(['2', '1']);
    expect(orderDisplayFiles({} as Order)).toEqual([]);
  });

  it('resolves quote files through the catalog map', () => {
    const q = { cadFileIds: ['2', 'missing'] } as unknown as Quote;
    const byId = new Map([['1', cad('1', 'A.STL')], ['2', cad('2', 'Cover.STEP')]]);
    expect(quoteDisplayFiles(q, byId).map((f) => f.id)).toEqual(['2']);
  });

  it('deduplicates extensions in first-seen order', () => {
    const files = [cad('1', 'A.STL'), cad('2', 'B.STL'), cad('3', 'C.STEP'), cad('4', 'D.OBJ')];
    expect(dedupExtensions(files)).toEqual(['STL', 'STEP', 'OBJ']);
  });

  it('computes stack overflow counts', () => {
    expect(stackOverflowCount(1)).toBe(0);
    expect(stackOverflowCount(2)).toBe(1);
    expect(stackOverflowCount(4)).toBe(3);
  });
});
