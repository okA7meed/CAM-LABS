import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../ui/Icon';
import { AdminLayout } from './AdminLayout';
import { DashboardStats, DashboardRange } from './dashboard/types';
import { StatCard } from './dashboard/StatCard';
import { QuickActions } from './dashboard/QuickActions';
import { SystemStatus } from './dashboard/SystemStatus';
import { OrderChart } from './dashboard/OrderChart';
import { RecentActivityList } from './dashboard/RecentActivityList';

const RANGES: Array<{ key: DashboardRange; labelKey: string }> = [
  { key: '7', labelKey: 'admin.dashboard.range7' },
  { key: '30', labelKey: 'admin.dashboard.range30' },
  { key: '90', labelKey: 'admin.dashboard.range90' },
  { key: 'year', labelKey: 'admin.dashboard.rangeYear' },
];

const KpiSkeleton: React.FC = () => (
  <div className="kpi-grid" aria-hidden="true">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="kpi-card skeleton-block" />
    ))}
  </div>
);

export const AdminDashboardView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast, setActiveView } = useStore();
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [range, setRange] = useState<DashboardRange>('30');

  const load = useCallback(
    async (nextRange: DashboardRange, initial: boolean) => {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(false);
      try {
        const response = await fetch(`/api/v1/admin/dashboard?range=${nextRange}`, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Failed to load dashboard statistics');
        const data = await response.json();
        setStats(data.data);
      } catch (err: any) {
        setError(true);
        if (!stats) showToast('Error', err.message || 'Failed to load dashboard data', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast, stats],
  );

  useEffect(() => {
    void load(range, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeRange = (nextRange: DashboardRange) => {
    if (nextRange === range) return;
    setRange(nextRange);
    void load(nextRange, false);
  };

  const renderStats = () => {
    const s = stats;
    return (
      <>
        <section className="kpi-grid" aria-label={t('admin.dashboard.title')}>
          <StatCard
            title={t('admin.dashboard.totalOrders')}
            value={s!.orders.total.toLocaleString()}
            subtitle={t('admin.dashboard.ordersSub', { pending: s!.orders.pending, production: s!.orders.inProduction })}
            icon="layers3"
            tone="blue"
            spark={s!.trends.orders}
          />
          <StatCard
            title={t('admin.dashboard.revenue')}
            value={`${s!.revenue.total.toLocaleString()} ${s!.revenue.currency}`}
            subtitle={t('admin.dashboard.revenueSub', { count: s!.revenue.orderCount })}
            icon="wallet"
            tone="green"
            spark={s!.trends.revenue}
          />
          <StatCard
            title={t('admin.dashboard.customers')}
            value={s!.customers.total.toLocaleString()}
            subtitle={t('admin.dashboard.usersSub')}
            icon="users"
            tone="amber"
            spark={s!.trends.customers}
          />
          <StatCard
            title={t('admin.dashboard.quotes')}
            value={s!.quotes.active.toLocaleString()}
            subtitle={t('admin.dashboard.quotesSub', { total: s!.quotes.total })}
            icon="file"
            tone="cyan"
            spark={s!.trends.quotes}
          />
          <StatCard
            title={t('admin.dashboard.cadFiles')}
            value={s!.cadFiles.total.toLocaleString()}
            subtitle={t('admin.dashboard.cadSub')}
            icon="cube"
            tone="purple"
            spark={s!.trends.cadFiles}
          />
          <StatCard
            title={t('admin.dashboard.manufacturers')}
            value={s!.manufacturers.total.toLocaleString()}
            subtitle={t('admin.dashboard.manufacturersSub', {
              total: s!.manufacturers.total,
              pending: s!.manufacturingRequests.pending,
            })}
            icon="target"
            tone="magenta"
            spark={s!.trends.manufacturers}
          />
        </section>

        <div className="dashboard-lower">
          <QuickActions role={currentUser?.role} onNavigate={setActiveView} />
          <SystemStatus stats={s} />
        </div>

        <section className="analytics-grid">
          <div className="widget">
            <div className="widget-header">
              <h2 className="widget-title">{t('admin.dashboard.orderOverview')}</h2>
              <span className="widget-caption">{t('admin.dashboard.orderOverviewSub')}</span>
              <div className="range-tabs" role="group" aria-label={t('admin.dashboard.orderOverview')}>
                {RANGES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`range-tab ${item.key === range ? 'active' : ''}`}
                    aria-pressed={item.key === range}
                    onClick={() => changeRange(item.key)}
                  >
                    {t(item.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            {refreshing ? (
              <div className="chart-skeleton" aria-hidden="true" />
            ) : (
              <OrderChart data={s!.orderTimeline} emptyLabel={t('admin.dashboard.noOrderActivity')} />
            )}
          </div>

          <RecentActivityList items={s!.activity} onViewAll={() => setActiveView('admin-audit-logs')} />
        </section>
      </>
    );
  };

  const renderBody = () => {
    if (loading) {
      return (
        <>
          <KpiSkeleton />
          <div className="dashboard-lower">
            <div className="widget skeleton-block" />
            <div className="widget skeleton-block" />
          </div>
        </>
      );
    }
    if (error && !stats) {
      return (
        <div className="error-state" role="alert">
          <span className="error-state-icon" aria-hidden="true">
            <Icon name="alert" size={20} />
          </span>
          <span className="error-state-title">{t('admin.dashboard.loadError')}</span>
          <button type="button" className="cam-btn cam-btn-outline error-state-retry" onClick={() => void load(range, true)}>
            {t('admin.dashboard.retry')}
          </button>
        </div>
      );
    }
    return stats ? renderStats() : null;
  };

  return (
    <AdminLayout title={t('admin.dashboard.subtitle')} subtitle={t('admin.dashboard.title')}>
      {renderBody()}
    </AdminLayout>
  );
};