import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';

export const AdminNotificationsView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/notifications', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setNotifications(data.data || []);
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/v1/admin/notifications/${id}/read`, { method: 'PUT', credentials: 'same-origin' });
      load();
    } catch { }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'ERROR': return '#ef4444';
      case 'WARNING': return '#f59e0b';
      case 'SUCCESS': return '#10b981';
      default: return '#3b82f6';
    }
  };

  return (
    <AdminLayout title={t('admin.notifications.title')} subtitle={t('admin.notifications.subtitle')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-faint)' }}>{t('admin.notifications.loading')}</div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-faint)' }}>{t('admin.notifications.empty')}</div>
        ) : (
          notifications.map((n: any) => (
            <div
              key={n.id}
              onClick={() => !n.isRead && markRead(n.id)}
              style={{
                padding: '16px',
                background: n.isRead ? 'var(--cam-surface-1)' : 'var(--cam-surface-2)',
                borderRadius: '8px',
                border: `1px solid ${n.isRead ? 'var(--cam-border-subtle)' : `${getPriorityColor(n.priority)}40`}`,
                cursor: n.isRead ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: getPriorityColor(n.priority),
                marginTop: '6px',
                flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--cam-text-secondary)', marginBottom: '4px' }}>{n.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{n.message}</div>
                <div style={{ fontSize: '11px', color: 'var(--cam-text-faint)', marginTop: '6px' }}>
                  {new Date(n.createdAt).toLocaleString()} · {n.type}
                </div>
              </div>
              {!n.isRead && (
                <span style={{ fontSize: '10px', color: '#3b82f6', padding: '2px 6px', background: 'rgba(59,130,246,0.1)', borderRadius: '4px' }}>
                  {t('admin.notifications.new')}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
};