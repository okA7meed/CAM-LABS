import { AdminNotification } from '../../../types';
import { bucketDay, formatLongDate } from '../../../utils/dateTime';
import { notificationCategoryOf } from '../../../utils/notificationUi';

export type NotificationTab = 'all' | 'unread' | 'quotes' | 'orders' | 'customers' | 'system';
export type DateRange = 'all' | 'today' | 'yesterday' | 'last7' | 'last30';

export const NOTIFICATION_TABS: NotificationTab[] = ['all', 'unread', 'quotes', 'orders', 'customers', 'system'];

/** Tab membership. Payment rows surface under All/Unread and inside the
 *  System tab (the only operational bucket left); Quotes/Orders/Customers
 *  tabs stay strictly scoped to their own taxonomy. */
export function matchesTab(n: AdminNotification, tab: NotificationTab): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'unread':
      return !n.isRead;
    case 'quotes':
      return n.type === 'QUOTE';
    case 'orders':
      return n.type === 'ORDER';
    case 'customers':
      return n.type === 'USER_REGISTERED' || n.type === 'USER_LOGIN';
    case 'system':
      return notificationCategoryOf(n) !== 'quote'
        && notificationCategoryOf(n) !== 'order'
        && notificationCategoryOf(n) !== 'customer';
    default:
      return true;
  }
}

const searchableOf = (n: AdminNotification): string => {
  const meta = (n.metadata || {}) as Record<string, unknown>;
  const parts: unknown[] = [
    n.title,
    n.message,
    n.entityId,
    meta.reference,
    meta.quoteId,
    meta.orderId,
    meta.customerName,
    meta.name,
  ];
  return parts.filter((p) => typeof p === 'string').join(' ').toLowerCase();
};

export function matchesSearch(n: AdminNotification, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return searchableOf(n).includes(q);
}

export function matchesRange(n: AdminNotification, range: DateRange, now: number = Date.now()): boolean {
  if (range === 'all') return true;
  const t = new Date(n.createdAt).getTime();
  if (Number.isNaN(t)) return false;
  if (range === 'today' || range === 'yesterday') return bucketDay(t, now) === range;
  const windowMs = range === 'last7' ? 7 * 86_400_000 : 30 * 86_400_000;
  return now - t <= windowMs;
}

export function filterNotifications(
  all: AdminNotification[],
  tab: NotificationTab,
  query: string,
  range: DateRange,
  now: number = Date.now()
): AdminNotification[] {
  return all.filter((n) => matchesTab(n, tab) && matchesSearch(n, query) && matchesRange(n, range, now));
}

export interface NotificationGroup {
  key: 'today' | 'yesterday' | 'earlier';
  count: number;
  /** Long date context for today/yesterday groups ("September 19, 2026"). */
  dateLabel: string | null;
  items: AdminNotification[];
}

/** Today → Yesterday → Earlier, preserving API (newest-first) order inside. */
export function groupNotifications(items: AdminNotification[], now: number = Date.now()): NotificationGroup[] {
  const buckets: Record<'today' | 'yesterday' | 'earlier', AdminNotification[]> = { today: [], yesterday: [], earlier: [] };
  for (const n of items) {
    const bucket = bucketDay(n.createdAt, now) ?? 'earlier';
    buckets[bucket].push(n);
  }
  const groups: NotificationGroup[] = [];
  if (buckets.today.length > 0) {
    groups.push({ key: 'today', count: buckets.today.length, dateLabel: formatLongDate(now), items: buckets.today });
  }
  if (buckets.yesterday.length > 0) {
    const ref = buckets.yesterday[0];
    groups.push({ key: 'yesterday', count: buckets.yesterday.length, dateLabel: formatLongDate(ref.createdAt), items: buckets.yesterday });
  }
  if (buckets.earlier.length > 0) {
    groups.push({ key: 'earlier', count: buckets.earlier.length, dateLabel: null, items: buckets.earlier });
  }
  return groups;
}

export interface NotificationCounts {
  total: number;
  unread: number;
  quotes: number;
  orders: number;
  customers: number;
  system: number;
  quotesUnread: number;
  ordersUnread: number;
  customersUnread: number;
  systemUnread: number;
}

/** Counts over the loaded window. Tab badges and summary cards share this
 *  single derivation, so they can never disagree with each other. */
export function countNotifications(all: AdminNotification[]): NotificationCounts {
  let unread = 0;
  let quotes = 0;
  let orders = 0;
  let customers = 0;
  let quotesUnread = 0;
  let ordersUnread = 0;
  let customersUnread = 0;
  let systemUnread = 0;
  for (const n of all) {
    const tab =
      n.type === 'QUOTE' ? 'quotes'
      : n.type === 'ORDER' ? 'orders'
      : n.type === 'USER_REGISTERED' || n.type === 'USER_LOGIN' ? 'customers'
      : 'system';
    if (tab === 'quotes') quotes += 1;
    else if (tab === 'orders') orders += 1;
    else if (tab === 'customers') customers += 1;
    if (!n.isRead) {
      unread += 1;
      if (tab === 'quotes') quotesUnread += 1;
      else if (tab === 'orders') ordersUnread += 1;
      else if (tab === 'customers') customersUnread += 1;
      else systemUnread += 1;
    }
  }
  return {
    total: all.length,
    unread,
    quotes,
    orders,
    customers,
    system: all.length - quotes - orders - customers,
    quotesUnread,
    ordersUnread,
    customersUnread,
    systemUnread,
  };
}
