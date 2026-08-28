import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { Icon } from '../ui/Icon';
import { AdminLayout } from './AdminLayout';

interface DashboardStats {
  orders: {
    total: number;
    pending: number;
    inProduction: number;
    completed: number;
  };
  users: {
    total: number;
  };
  quotes: {
    total: number;
  };
  cadFiles: {
    total: number;
  };
  manufacturers: {
    total: number;
    active: number;
  };
  manufacturingRequests: {
    pending: number;
  };
  revenue: {
    total: number;
    currency: string;
  };
}

export const AdminDashboardView: React.FC = () => {
  const { showToast, setActiveView } = useStore();
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboardStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/admin/dashboard', {
        credentials: 'same-origin',
      });
      
      if (!response.ok) {
        throw new Error('Failed to load dashboard statistics');
      }

      const data = await response.json();
      setStats(data.data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const StatCard = ({ title, value, subtitle, icon, color }: { title: string; value: string | number; subtitle?: string; icon: any; color: string }) => (
    <div style={{
      background: 'var(--cam-surface-1)',
      border: '1px solid var(--cam-border-subtle)',
      borderRadius: '12px',
      padding: '24px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '10px',
        background: color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name={icon} size={24} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.875rem', color: 'var(--cam-text-muted)', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--cam-text-primary)', marginBottom: '4px' }}>{value}</div>
        {subtitle && <div style={{ fontSize: '0.75rem', color: 'var(--cam-text-muted)' }}>{subtitle}</div>}
      </div>
    </div>
  );

  if (loading) {
    return (
      <AdminLayout title={t('admin.dashboard.title')} subtitle={t('admin.dashboard.subtitle')}>
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="skeleton" style={{ width: '80px', height: '80px', margin: '0 auto 20px', borderRadius: '50%' }} />
          <p>{t('admin.dashboard.loading')}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={t('admin.dashboard.title')} subtitle={t('admin.dashboard.subtitle')}>
      <div className="dashboard-header-bar" style={{ marginBottom: '32px' }}>
          <div>
            <div className="user-welcome-title">
              <span>{t('admin.dashboard.heading')}</span>
            </div>
            <div className="dashboard-user-meta">
              {t('admin.dashboard.subheading')}
            </div>
          </div>
          <div className="dashboard-actions-cluster">
            <button className="btn btn-sm btn-outline" onClick={() => window.location.href = '/'}>
              <Icon name="arrowRight" size={14} /> {t('admin.dashboard.backToWebsite')}
            </button>
            <button className="btn btn-sm btn-primary" onClick={loadDashboardStats}>
              <Icon name="reset" size={14} /> {t('admin.dashboard.refresh')}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <StatCard
            title={t('admin.dashboard.totalOrders')}
            value={stats?.orders.total || 0}
            subtitle={t('admin.dashboard.ordersSub', { pending: stats?.orders.pending || 0, production: stats?.orders.inProduction || 0 })}
            icon="layers"
            color="rgba(0, 102, 255, 0.2)"
          />
          <StatCard
            title={t('admin.dashboard.revenue')}
            value={`${stats?.revenue.total.toLocaleString()} ${stats?.revenue.currency}`}
            subtitle={t('admin.dashboard.revenueSub')}
            icon="clipboard"
            color="rgba(16, 185, 129, 0.2)"
          />
          <StatCard
            title={t('admin.dashboard.customers')}
            value={stats?.users.total || 0}
            subtitle={t('admin.dashboard.usersSub')}
            icon="check"
            color="rgba(245, 158, 11, 0.2)"
          />
          <StatCard
            title={t('admin.dashboard.quotes')}
            value={stats?.quotes.total || 0}
            subtitle={t('admin.dashboard.quotesSub')}
            icon="file"
            color="rgba(6, 182, 212, 0.2)"
          />
          <StatCard
            title={t('admin.dashboard.cadFiles')}
            value={stats?.cadFiles.total || 0}
            subtitle={t('admin.dashboard.cadSub')}
            icon="cube"
            color="rgba(139, 92, 246, 0.2)"
          />
          <StatCard
            title={t('admin.dashboard.manufacturers')}
            value={stats?.manufacturers.active || 0}
            subtitle={t('admin.dashboard.manufacturersSub', { total: stats?.manufacturers.total || 0, pending: stats?.manufacturingRequests.pending || 0 })}
            icon="technology"
            color="rgba(236, 72, 153, 0.2)"
          />
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--cam-text-primary)', marginBottom: '16px' }}>{t('admin.dashboard.quickActions')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <button
              className="btn btn-outline"
              onClick={() => setActiveView('admin-orders')}
              style={{ justifyContent: 'flex-start', gap: '12px' }}
            >
              <Icon name="layers" size={16} /> {t('admin.dashboard.manageOrders')}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setActiveView('admin-manufacturers')}
              style={{ justifyContent: 'flex-start', gap: '12px' }}
            >
              <Icon name="technology" size={16} /> {t('admin.dashboard.manageManufacturers')}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setActiveView('admin-pricing')}
              style={{ justifyContent: 'flex-start', gap: '12px' }}
            >
              <Icon name="configure" size={16} /> {t('admin.dashboard.managePricing')}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setActiveView('admin-customers')}
              style={{ justifyContent: 'flex-start', gap: '12px' }}
            >
              <Icon name="review" size={16} /> {t('admin.dashboard.manageCustomers')}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setActiveView('admin-materials')}
              style={{ justifyContent: 'flex-start', gap: '12px' }}
            >
              <Icon name="cube" size={16} /> {t('admin.dashboard.manageMaterials')}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setActiveView('admin-users')}
              style={{ justifyContent: 'flex-start', gap: '12px' }}
            >
              <Icon name="configure" size={16} /> {t('admin.dashboard.manageAdminUsers')}
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dashboard-section-panel">
          <div className="panel-header-row">
            <div className="panel-title-group">
              <h3 className="panel-title">{t('admin.dashboard.systemStatus')}</h3>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', background: 'var(--cam-success-subtle)', borderRadius: '8px', border: '1px solid ' +
              'rgba(16, 185, 129, 0.25)' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--cam-success)', marginBottom: '8px', fontWeight: '600' }}>
                <Icon name="check" size={14} /> {t('admin.dashboard.platformOperational')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--cam-text-muted)' }}>{t('admin.dashboard.platformOperationalSub')}</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--cam-blue-subtle)', borderRadius: '8px', border: '1px solid ' +
              'rgba(0, 102, 255, 0.25)' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--cam-blue-primary)', marginBottom: '8px', fontWeight: '600' }}>
                <Icon name="cpu" size={14} /> {t('admin.dashboard.manufacturingEngine')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--cam-text-muted)' }}>{t('admin.dashboard.activeManufacturers', { count: stats?.manufacturers.active || 0 })}</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--cam-warning-subtle)', borderRadius: '8px', border: '1px solid ' +
              'rgba(245, 158, 11, 0.25)' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--cam-warning)', marginBottom: '8px', fontWeight: '600' }}>
                <Icon name="alert" size={14} /> {t('admin.dashboard.pendingActions')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--cam-text-muted)' }}>{t('admin.dashboard.pendingRequests', { count: stats?.manufacturingRequests.pending || 0 })}</div>
            </div>
          </div>
        </div>
    </AdminLayout>
  );
};