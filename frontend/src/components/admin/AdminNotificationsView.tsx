import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { useNotifications } from '../../context/NotificationsContext';
import { AdminLayout } from './AdminLayout';
import { AdminCard, AdminCardBody } from './ui/Card';
import { EmptyState, ErrorState } from './ui/States';
import { Icon } from '../ui/Icon';
import { ApiService } from '../../services/api';
import { AdminNotification } from '../../types';
import { notificationIcon, notificationPriorityColor, notificationTypeLabel, openNotificationTarget } from '../../utils/notificationUi';
import { formatRelativeTime } from '../../utils/relativeTime';

type NotificationFilter = 'all' | 'unread' | 'QUOTE' | 'ORDER' | 'USERS';

const FILTER_OPTIONS: Array<{ value: NotificationFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'admin.notifications.filters.all' },
  { value: 'unread', labelKey: 'admin.notifications.filters.unread' },
  { value: 'QUOTE', labelKey: 'admin.notifications.filters.quotes' },
  { value: 'ORDER', labelKey: 'admin.notifications.filters.orders' },
  { value: 'USERS', labelKey: 'admin.notifications.filters.users' },
];

export const AdminNotificationsView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showToast, setActiveView, openAdminOrderDetail, openAdminQuoteDetail, openAdminCustomerDetail } = useStore();
  const { notifications: liveNotifications, streamConnected, unread, markRead, markAllRead } = useNotifications();
  const [all, setAll] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await ApiService.getAdminNotifications({ limit: 500 });
      setAll(list?.notifications ?? []);
    } catch {
      setError(t('admin.notifications.error'));
      showToast(t('admin.notifications.error'), '', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live refresh whenever the SSE stream pushes a change or reconnects.
  useEffect(() => {
    if (liveNotifications.length > 0) void load();
  }, [liveNotifications.length, streamConnected, load]);

  const visible = useMemo(() => {
    switch (filter) {
      case 'unread':
        return all.filter((n) => !n.isRead);
      case 'QUOTE':
        return all.filter((n) => n.type === 'QUOTE');
      case 'ORDER':
        return all.filter((n) => n.type === 'ORDER');
      case 'USERS':
        return all.filter((n) => n.type === 'USER_REGISTERED' || n.type === 'USER_LOGIN');
      default:
        return all;
    }
  }, [all, filter]);

  const handleMarkRead = async (id: string) => {
    markRead(id);
    setAll((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)));
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setAll((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt ?? new Date().toISOString() })));
    showToast(t('admin.notifications.markAllRead'), '', 'success');
  };

  const handleOpen = (notification: AdminNotification) => {
    if (!notification.isRead) markRead(notification.id);
    openNotificationTarget(notification, {
      markRead: (id) => {
        markRead(id);
        setAll((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      },
      openAdminOrderDetail,
      openAdminQuoteDetail,
      openAdminCustomerDetail,
      openNotificationsPage: () => setActiveView('admin-notifications'),
    });
  };

  const subtitle = t('admin.notifications.subtitle');

  return (
    <AdminLayout title={t('admin.notifications.title')} subtitle={subtitle}>
      <div className="admin-section">
        <div className="admin-section-head admin-notif-toolbar">
          <div className="admin-filter-tabs" role="tablist" aria-label={t('admin.notifications.title')}>
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={filter === option.value}
                className={`admin-filter-tab ${filter === option.value ? 'active' : ''}`}
                onClick={() => setFilter(option.value)}
              >
                {t(option.labelKey)}
                {option.value === 'unread' && unread > 0 && <span className="admin-filter-count">{unread > 99 ? '99+' : unread}</span>}
              </button>
            ))}
          </div>
          {visible.length > 0 && (
            <button type="button" className="cam-btn cam-btn-ghost cam-notif-markall-page" onClick={() => void handleMarkAllRead()} disabled={visible.every((n) => n.isRead)}>
              <Icon name="check" size={13} />
              <span className="cta-label">{t('admin.notifications.markAllRead')}</span>
            </button>
          )}
        </div>
        <AdminCard>
          <AdminCardBody>
            {error && all.length === 0 ? (
              <ErrorState text={error} onRetry={() => void load()} retryLabel={t('admin.lists.retry')} />
            ) : loading ? (
              <div className="admin-list">
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
                    <span className="skeleton-block" style={{ width: '32%', height: 14 }} />
                    <span className="skeleton-block" style={{ width: '62%', height: 12 }} />
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <EmptyState icon="bell" text={filter === 'all' ? t('admin.notifications.empty') : t('admin.notifications.emptyFilter')} />
            ) : (
              <div className="admin-list admin-notif-list">
                {visible.map((notification) => (
                  <div
                    key={notification.id}
                    className={`admin-notif-card ${notification.isRead ? 'read' : 'unread'}`}
                    onClick={() => handleOpen(notification)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleOpen(notification);
                      }
                    }}
                  >
                    <span className="admin-notif-ic" style={{ color: notificationPriorityColor(notification.priority) }}>
                      <Icon name={notificationIcon(notification.type)} size={17} />
                    </span>
                    <div className="admin-notif-copy">
                      <div className="admin-notif-line">
                        <span className="admin-notif-type">{notificationTypeLabel(notification.type, t)}</span>
                        <span className="admin-notif-time">{formatRelativeTime(notification.createdAt, i18n.language)}</span>
                      </div>
                      <div className="admin-notif-title-text">{notification.title}</div>
                      <div className="admin-notif-msg">{notification.message}</div>
                    </div>
                    {!notification.isRead && (
                      <button
                        type="button"
                        className="cam-icon-btn admin-notif-markread"
                        title={t('admin.notifications.markRead')}
                        aria-label={t('admin.notifications.markRead')}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleMarkRead(notification.id);
                        }}
                      >
                        <Icon name="check" size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </AdminCardBody>
        </AdminCard>
      </div>
    </AdminLayout>
  );
};