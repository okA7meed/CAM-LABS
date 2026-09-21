import { describe, expect, it } from 'vitest';
import { AdminNotification } from '../../../types';
import {
  countNotifications,
  filterNotifications,
  groupNotifications,
  matchesRange,
  matchesSearch,
  matchesTab,
} from './notificationModel';
import {
  notificationCategoryOf,
  notificationContextOf,
  notificationReferenceOf,
  resolveNotificationDestination,
} from '../../../utils/notificationUi';

const n = (overrides: Partial<AdminNotification>): AdminNotification => ({
  id: `n-${Math.random().toString(36).slice(2)}`,
  userId: null,
  type: 'QUOTE',
  title: 'New Quote Submitted',
  message: 'Quote CAM-2026-177132 submitted for Center Distance Adjustment.STL.',
  metadata: { reference: 'CAM-2026-177132', customerId: 'c-1' },
  priority: 'INFO',
  entityType: 'QUOTE',
  entityId: 'RFQ-2026-717136',
  isRead: false,
  createdAt: '2026-09-19T08:42:00.000Z',
  readAt: null,
  ...overrides,
});

describe('notificationCategoryOf', () => {
  it('maps the real taxonomy to categories', () => {
    expect(notificationCategoryOf({ type: 'QUOTE', priority: 'INFO' })).toBe('quote');
    expect(notificationCategoryOf({ type: 'ORDER', priority: 'SUCCESS' })).toBe('order');
    expect(notificationCategoryOf({ type: 'USER_REGISTERED', priority: 'SUCCESS' })).toBe('customer');
    expect(notificationCategoryOf({ type: 'USER_LOGIN', priority: 'INFO' })).toBe('customer');
    expect(notificationCategoryOf({ type: 'PAYMENT', priority: 'SUCCESS' })).toBe('payment');
    expect(notificationCategoryOf({ type: 'SYSTEM', priority: 'INFO' })).toBe('system');
    expect(notificationCategoryOf({ type: 'SOMETHING_NEW', priority: 'INFO' })).toBe('system');
  });
  it('escalates ERROR priority to warning treatment', () => {
    expect(notificationCategoryOf({ type: 'ORDER', priority: 'ERROR' })).toBe('warning');
  });
});

describe('notificationReferenceOf', () => {
  it('prefers the unified CAM reference from metadata', () => {
    expect(notificationReferenceOf(n({}))).toBe('CAM-2026-177132');
  });
  it('prefers the server-resolved live reference over a stale RFQ entity id', () => {
    expect(
      notificationReferenceOf(n({ metadata: {}, entityId: 'RFQ-2026-552132', resolvedReference: 'CAM-2026-409541' }))
    ).toBe('CAM-2026-409541');
  });
  it('falls back to the entity id when no metadata reference exists', () => {
    expect(notificationReferenceOf(n({ metadata: {}, entityId: 'CAM-2026-409541' }))).toBe('CAM-2026-409541');
  });
  it('returns null when nothing referenceable exists', () => {
    expect(notificationReferenceOf(n({ metadata: {}, entityId: null }))).toBeNull();
  });
});

describe('notificationContextOf', () => {
  it('shows the customer name for user events', () => {
    const out = notificationContextOf(
      n({ type: 'USER_LOGIN', metadata: { customerName: 'Ahmed Khaled Hussain' }, entityId: 'c-1' })
    );
    expect(out).toMatchObject({ value: 'Ahmed Khaled Hussain' });
  });
  it('shows the reference for quote/order events', () => {
    expect(notificationContextOf(n({}))?.value).toBe('CAM-2026-177132');
  });
});

describe('resolveNotificationDestination', () => {
  it('resolves quote/order/customer records', () => {
    expect(resolveNotificationDestination(n({}))).toMatchObject({ kind: 'quote', id: 'RFQ-2026-717136' });
    expect(resolveNotificationDestination(n({ type: 'ORDER', entityId: 'CAM-1' }))).toMatchObject({ kind: 'order' });
    expect(resolveNotificationDestination(n({ type: 'USER_LOGIN', entityId: 'c-1' }))).toMatchObject({ kind: 'customer' });
  });
  it('resolves list destinations without fabricating record ids', () => {
    expect(resolveNotificationDestination(n({ type: 'PAYMENT', entityId: 'p-1' }))).toMatchObject({ kind: 'payments', id: null });
    expect(resolveNotificationDestination(n({ type: 'MANUFACTURING_REQUEST', entityId: 'm-1' }))).toMatchObject({
      kind: 'manufacturing-requests',
      id: null,
    });
  });
  it('returns none (no View action) when the entity is missing', () => {
    expect(resolveNotificationDestination(n({ entityId: null })).viewLabelKey).toBeNull();
  });
});

describe('matchesTab', () => {
  it('maps Customers to both user event types (never admin-user rows)', () => {
    expect(matchesTab(n({ type: 'USER_REGISTERED' }), 'customers')).toBe(true);
    expect(matchesTab(n({ type: 'USER_LOGIN' }), 'customers')).toBe(true);
    expect(matchesTab(n({ type: 'USER_LOGIN' }), 'system')).toBe(false);
    expect(matchesTab(n({ type: 'QUOTE' }), 'customers')).toBe(false);
  });
  it('keeps payment out of order/system confusion: visible under all+unread', () => {
    const p = n({ type: 'PAYMENT' });
    expect(matchesTab(p, 'all')).toBe(true);
    expect(matchesTab(p, 'unread')).toBe(true);
    expect(matchesTab(p, 'orders')).toBe(false);
  });
});

describe('matchesSearch', () => {
  it('matches title, message, reference, customer and entity id', () => {
    const item = n({});
    expect(matchesSearch(item, 'center distance')).toBe(true);
    expect(matchesSearch(item, 'CAM-2026-177132')).toBe(true);
    expect(matchesSearch(item, 'rfq-2026-717136')).toBe(true);
    expect(matchesSearch(item, 'nope-nothing')).toBe(false);
    expect(matchesSearch(item, '  ')).toBe(true);
  });
});

describe('matchesRange', () => {
  const NOW = Date.parse('2026-09-19T10:00:00.000Z');
  it('supports all/today/yesterday/last7/last30', () => {
    expect(matchesRange(n({ createdAt: '2026-09-19T08:00:00.000Z' }), 'today', NOW)).toBe(true);
    expect(matchesRange(n({ createdAt: '2026-09-18T20:00:00.000Z' }), 'yesterday', NOW)).toBe(true);
    expect(matchesRange(n({ createdAt: '2026-09-18T20:00:00.000Z' }), 'today', NOW)).toBe(false);
    expect(matchesRange(n({ createdAt: '2026-09-14T10:00:00.000Z' }), 'last7', NOW)).toBe(true);
    expect(matchesRange(n({ createdAt: '2026-09-01T10:00:00.000Z' }), 'last7', NOW)).toBe(false);
    expect(matchesRange(n({ createdAt: '2026-09-01T10:00:00.000Z' }), 'last30', NOW)).toBe(true);
  });
});

describe('filterNotifications composition', () => {
  const NOW = Date.parse('2026-09-19T10:00:00.000Z');
  const rows = [
    n({ id: 'a', type: 'QUOTE', createdAt: '2026-09-19T08:00:00.000Z' }),
    n({ id: 'b', type: 'ORDER', createdAt: '2026-09-18T20:00:00.000Z', isRead: true, readAt: 'x' }),
    n({ id: 'c', type: 'USER_LOGIN', createdAt: '2026-09-10T10:00:00.000Z' }),
  ];
  it('combines tab + search + range conjunctively', () => {
    expect(filterNotifications(rows, 'quotes', '', 'all', NOW).map((r) => r.id)).toEqual(['a']);
    expect(filterNotifications(rows, 'all', 'center distance', 'last7', NOW).map((r) => r.id)).toEqual(['a', 'b']);
    expect(filterNotifications(rows, 'unread', '', 'today', NOW).map((r) => r.id)).toEqual(['a']);
    expect(filterNotifications(rows, 'customers', '', 'all', NOW).map((r) => r.id)).toEqual(['c']);
  });
});

describe('groupNotifications', () => {
  const NOW = Date.parse('2026-09-19T10:00:00.000Z');
  it('emits Today/Yesterday/Earlier in order with real counts', () => {
    const groups = groupNotifications(
      [
        n({ id: 'a', createdAt: '2026-09-19T08:00:00.000Z' }),
        n({ id: 'b', createdAt: '2026-09-18T20:00:00.000Z' }),
        n({ id: 'c', createdAt: '2026-09-10T10:00:00.000Z' }),
      ],
      NOW
    );
    expect(groups.map((g) => [g.key, g.count])).toEqual([
      ['today', 1],
      ['yesterday', 1],
      ['earlier', 1],
    ]);
    expect(groups[0].dateLabel).toBe('September 19, 2026');
    expect(groups[1].dateLabel).toBe('September 18, 2026');
    expect(groups[2].dateLabel).toBeNull();
  });
  it('omits empty groups', () => {
    expect(groupNotifications([], NOW)).toEqual([]);
  });
});

describe('countNotifications', () => {
  it('derives one consistent count set from the loaded window', () => {
    const rows = [
      n({ type: 'QUOTE' }),
      n({ type: 'QUOTE', isRead: true, readAt: 'x' }),
      n({ type: 'ORDER' }),
      n({ type: 'USER_LOGIN' }),
      n({ type: 'SYSTEM' }),
    ];
    expect(countNotifications(rows)).toEqual({
      total: 5,
      unread: 4,
      quotes: 2,
      orders: 1,
      customers: 1,
      system: 1,
      quotesUnread: 1,
      ordersUnread: 1,
      customersUnread: 1,
      systemUnread: 1,
    });
  });
});
