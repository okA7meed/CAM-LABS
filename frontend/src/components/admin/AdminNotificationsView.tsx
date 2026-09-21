import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { useNotifications } from '../../context/NotificationsContext';
import { AdminLayout } from './AdminLayout';
import { AdminNotification } from '../../types';
import { ApiService } from '../../services/api';
import {
  NotificationDestination,
  notificationContextOf,
  openNotificationTarget,
  resolveNotificationDestination,
} from '../../utils/notificationUi';
import { bucketDay, formatClock12h, formatLongDate, formatShortDate } from '../../utils/dateTime';
import { formatRelativeTime } from '../../utils/relativeTime';
import {
  DateRange,
  NotificationTab,
  countNotifications,
  filterNotifications,
  groupNotifications,
} from './notifications/notificationModel';
import { NotificationSummary } from './notifications/NotificationSummary';
import { NotificationToolbar } from './notifications/NotificationToolbar';
import { NotificationEmptyState, NotificationGroup } from './notifications/NotificationGroup';

export const AdminNotificationsView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showToast, setActiveView, openAdminOrderDetail, openAdminQuoteDetail, openAdminCustomerDetail } = useStore();
  const { notifications: liveNotifications, streamConnected, unread: serverUnread, markRead, markAllRead } = useNotifications();
  const [all, setAll] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationTab>('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [range, setRange] = useState<DateRange>('all');
  const [serverCounts, setServerCounts] = useState<{
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
  } | null>(null);
  // Minute tick so relative timestamps ("2 hours ago") stay fresh on a
  // long-mounted page without refetching.
  const [nowTick, setNowTick] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await ApiService.getAdminNotifications({ limit: 500 });
      setAll(list?.notifications ?? []);
      // Server aggregation is the single source for every global count
      // (summary cards + tab badges + header). Row-derived counts are only
      // a fallback for responses that predate the counts field.
      if (list?.counts) setServerCounts(list.counts);
    } catch {
      // Single inline error state (with Retry) — never a toast storm.
      setError(t('admin.notifications.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live refresh whenever the SSE stream pushes a change or reconnects.
  // Local filter/search/range state is untouched, so nothing resets or jumps.
  useEffect(() => {
    if (liveNotifications.length > 0) void load();
  }, [liveNotifications.length, streamConnected, load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  const rowCounts = useMemo(() => countNotifications(all), [all]);
  // Global truth prefers the server aggregation (same visibility scope as
  // the list, independent of the 500-row window). Row-derived counts are a
  // fallback only; the two agree whenever the window covers full history.
  const counts = useMemo(
    () => ({
      total: serverCounts?.total ?? rowCounts.total,
      unread: serverCounts?.unread ?? serverUnread,
      quotes: serverCounts?.quotes ?? rowCounts.quotes,
      orders: serverCounts?.orders ?? rowCounts.orders,
      customers: serverCounts?.customers ?? rowCounts.customers,
      system: serverCounts?.system ?? rowCounts.system,
      quotesUnread: serverCounts?.quotesUnread ?? rowCounts.quotesUnread,
      ordersUnread: serverCounts?.ordersUnread ?? rowCounts.ordersUnread,
      customersUnread: serverCounts?.customersUnread ?? rowCounts.customersUnread,
      systemUnread: serverCounts?.systemUnread ?? rowCounts.systemUnread,
    }),
    [serverCounts, rowCounts, serverUnread]
  );
  const tabCounts = useMemo<Record<NotificationTab, number>>(
    () => ({
      all: counts.total,
      unread: counts.unread,
      quotes: counts.quotes,
      orders: counts.orders,
      customers: counts.customers,
      system: counts.system,
    }),
    [counts]
  );

  const visible = useMemo(
    () => filterNotifications(all, filter, debouncedQuery, range, nowTick),
    [all, filter, debouncedQuery, range, nowTick]
  );
  const groups = useMemo(() => groupNotifications(visible, nowTick), [visible, nowTick]);

  const timeOf = useCallback(
    (n: AdminNotification) => {
      const bucket = bucketDay(n.createdAt, nowTick) ?? 'earlier';
      const exact = formatClock12h(n.createdAt);
      if (bucket === 'today') return { primary: formatRelativeTime(n.createdAt, i18n.language), secondary: exact };
      if (bucket === 'yesterday') return { primary: t('admin.notifications.groups.yesterday'), secondary: exact };
      return { primary: formatShortDate(n.createdAt), secondary: exact };
    },
    [nowTick, i18n.language, t]
  );

  const contextOf = useCallback((n: AdminNotification) => {
    const context = notificationContextOf(n);
    if (!context) return { label: null, value: null };
    return { label: t(context.labelKey), value: context.value };
  }, [t]);

  const destinationOf = useCallback((n: AdminNotification) => resolveNotificationDestination(n), []);

  const navigateDestination = useCallback(
    (destination: NotificationDestination) => {
      switch (destination.kind) {
        case 'quote':
          if (destination.id) openAdminQuoteDetail(destination.id);
          return;
        case 'order':
          if (destination.id) openAdminOrderDetail(destination.id);
          return;
        case 'customer':
          if (destination.id) openAdminCustomerDetail(destination.id);
          return;
        case 'payments':
          setActiveView('admin-payments');
          return;
        case 'manufacturing-requests':
          setActiveView('admin-manufacturing-requests');
          return;
        case 'materials':
          setActiveView('admin-materials');
          return;
        case 'audit':
          setActiveView('admin-audit-logs');
          return;
        default:
          return;
      }
    },
    [openAdminQuoteDetail, openAdminOrderDetail, openAdminCustomerDetail, setActiveView]
  );

  const unreadBucketOf = useCallback((n: AdminNotification): 'quotesUnread' | 'ordersUnread' | 'customersUnread' | 'systemUnread' => {
    if (n.type === 'QUOTE') return 'quotesUnread';
    if (n.type === 'ORDER') return 'ordersUnread';
    if (n.type === 'USER_REGISTERED' || n.type === 'USER_LOGIN') return 'customersUnread';
    return 'systemUnread';
  }, []);

  const handleMarkRead = useCallback(
    (id: string) => {
      const target = all.find((n) => n.id === id);
      // Local rows update instantly; the NotificationsContext persists + fans
      // out server-side. The cached server aggregation must move with it, or
      // summary cards/tab badges lag one poll behind the rows.
      if (target && !target.isRead) {
        const bucket = unreadBucketOf(target);
        setServerCounts((prev) =>
          prev && prev.unread > 0
            ? { ...prev, unread: prev.unread - 1, [bucket]: Math.max(0, prev[bucket] - 1) }
            : prev
        );
      }
      markRead(id);
      setAll((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)));
    },
    [markRead, all, unreadBucketOf]
  );

  const handleMarkAllRead = useCallback(async () => {
    await markAllRead();
    setAll((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt ?? new Date().toISOString() })));
    setServerCounts((prev) =>
      prev ? { ...prev, unread: 0, quotesUnread: 0, ordersUnread: 0, customersUnread: 0, systemUnread: 0 } : prev
    );
    showToast(t('admin.notifications.markAllRead'), '', 'success');
  }, [markAllRead, showToast, t]);

  const handleOpen = useCallback(
    (notification: AdminNotification) => {
      if (!notification.isRead) handleMarkRead(notification.id);
      openNotificationTarget(notification, {
        markRead: handleMarkRead,
        openAdminOrderDetail,
        openAdminQuoteDetail,
        openAdminCustomerDetail,
        openNotificationsPage: () => setActiveView('admin-notifications'),
      });
    },
    [handleMarkRead, openAdminOrderDetail, openAdminQuoteDetail, openAdminCustomerDetail, setActiveView]
  );

  const subtitle = useMemo(() => {
    if (serverUnread > 0) return t('admin.notifications.subtitleWithUnread', { count: serverUnread });
    return t('admin.notifications.subtitle');
  }, [serverUnread, t]);

  const emptyKind = error ? 'error' : debouncedQuery || filter !== 'all' || range !== 'all' ? 'filtered' : 'empty';

  return (
    <AdminLayout title={t('admin.notifications.title')} subtitle={subtitle}>
      <div className="admin-section nc-page">
        <NotificationSummary counts={counts} />
        <NotificationToolbar
          tab={filter}
          onTab={setFilter}
          counts={tabCounts}
          query={query}
          onQuery={setQuery}
          range={range}
          onRange={setRange}
          onMarkAllRead={() => void handleMarkAllRead()}
          markAllDisabled={visible.every((n) => n.isRead)}
        />
        {loading ? (
          <NotificationEmptyState kind="loading" />
        ) : error && all.length === 0 ? (
          <NotificationEmptyState kind="error" message={error} onRetry={() => void load()} />
        ) : visible.length === 0 ? (
          <NotificationEmptyState kind={emptyKind === 'error' ? 'empty' : emptyKind} />
        ) : (
          groups.map((group) => (
            <NotificationGroup
              key={group.key}
              group={group}
              timeOf={timeOf}
              contextOf={contextOf}
              destinationOf={destinationOf}
              onOpen={handleOpen}
              onMarkRead={handleMarkRead}
              onNavigate={navigateDestination}
            />
          ))
        )}
        {!loading && !error && visible.length > 0 ? (
          <p className="nc-footnote">
            {t('admin.notifications.showingCount', { shown: visible.length, total: all.length })} · {formatLongDate(nowTick)}
          </p>
        ) : null}
      </div>
    </AdminLayout>
  );
};
