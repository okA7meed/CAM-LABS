import React from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '../ui/StatCard';
import { OrderStats } from './types';

export const OrderStatsPanel: React.FC<{ stats: OrderStats }> = ({ stats }) => {
  const { t } = useTranslation();

  const orderSeries = stats.trend.map((day) => day.orders);
  const productionSeries = stats.trend.map((day) => day.inProduction);
  const reviewSeries = stats.trend.map((day) => day.inReview);
  const completedSeries = stats.trend.map((day) => day.completed);

  return (
    <div className="admin-kpi-grid">
      <StatCard
        title={t('admin.orders.kpi.total')}
        value={stats.totalOrders}
        subtitle={t('admin.orders.kpi.totalSub')}
        icon="clipboard"
        tone="blue"
        spark={orderSeries}
      />
      <StatCard
        title={t('admin.orders.kpi.inProduction')}
        value={stats.inProduction}
        subtitle={t('admin.orders.kpi.inProductionSub')}
        icon="precision"
        tone="green"
        spark={productionSeries}
      />
      <StatCard
        title={t('admin.orders.kpi.inReview')}
        value={stats.inReview}
        subtitle={t('admin.orders.kpi.inReviewSub')}
        icon="clock"
        tone="amber"
        spark={reviewSeries}
      />
      <StatCard
        title={t('admin.orders.kpi.completed')}
        value={stats.completed}
        subtitle={t('admin.orders.kpi.completedSub')}
        icon="check"
        tone="purple"
        spark={completedSeries}
      />
    </div>
  );
};