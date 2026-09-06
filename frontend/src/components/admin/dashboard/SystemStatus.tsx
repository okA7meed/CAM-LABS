import React from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardStats } from './types';

const CheckGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 4.2 4.2L19 6.5" />
  </svg>
);

const EngineGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
);

const AlertGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3 2.8 19h18.4L12 3Z" />
    <path d="M12 9v4" />
    <circle cx="12" cy="16" r="0.6" fill="currentColor" />
  </svg>
);

export const SystemStatus: React.FC<{ stats: DashboardStats | null }> = ({ stats }) => {
  const { t } = useTranslation();
  const platformTone: 'tone-green' | 'tone-amber' =
    stats?.system?.database === 'OPERATIONAL' ? 'tone-green' : 'tone-amber';
  const pending = stats?.pendingActions?.total ?? 0;

  return (
    <section className="widget" aria-label={t('admin.dashboard.systemStatus')}>
      <div className="widget-header">
        <h2 className="widget-title">{t('admin.dashboard.systemStatus')}</h2>
        <span className="widget-caption">{t('admin.dashboard.recentActivitySub')}</span>
        <button type="button" className="widget-link">
          {t('admin.dashboard.viewAll')}
        </button>
      </div>
      <div className="ss-list">
        <div className={`ss-row ${platformTone}`}>
          <span className="ss-marker" aria-hidden="true">
            <CheckGlyph />
            <span className={`ss-dot ${platformTone === 'tone-green' ? 'green' : 'amber'}`} />
          </span>
          <span className="ss-body">
            <span className="ss-label">{t('admin.dashboard.platformOperational')}</span>
            <span className="ss-sub">{t('admin.dashboard.platformOperationalSub')}</span>
          </span>
          <span className="ss-value">
            <span className="ss-value-main">100% {t('admin.dashboard.uptime')}</span>
            <span className="ss-value-sub">{t('admin.dashboard.healthy')}</span>
          </span>
        </div>
        <div className="ss-row tone-blue">
          <span className="ss-marker" aria-hidden="true">
            <EngineGlyph />
            <span className="ss-dot blue" />
          </span>
          <span className="ss-body">
            <span className="ss-label">{t('admin.dashboard.manufacturingEngine')}</span>
            <span className="ss-sub">
              {t('admin.dashboard.activeManufacturers', { count: stats?.manufacturers.active ?? 0 })}
            </span>
          </span>
          <span className="ss-value">
            <span className="ss-value-main">{t('admin.dashboard.running')}</span>
            <span className="ss-value-sub">{t('admin.dashboard.active')}</span>
          </span>
        </div>
        <div className="ss-row tone-amber">
          <span className="ss-marker" aria-hidden="true">
            <AlertGlyph />
            <span className="ss-dot amber" />
          </span>
          <span className="ss-body">
            <span className="ss-label">{t('admin.dashboard.pendingActions')}</span>
            <span className="ss-sub">{t('admin.dashboard.pendingActionsValue', { count: pending })}</span>
          </span>
          <span className="ss-value">
            <span className="ss-value-main">
              {pending} {t('admin.dashboard.pendingShort')}
            </span>
            <span className="ss-value-sub">{t('admin.dashboard.attention')}</span>
          </span>
        </div>
      </div>
    </section>
  );
};