import React from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { Icon, IconName } from '../../ui/Icon';
import { DashboardStats } from './types';

type ActivityTone = 'tone-blue' | 'tone-green' | 'tone-amber' | 'tone-cyan' | 'tone-purple' | 'tone-magenta';

const ENTITY_META: Record<string, { icon: IconName; tone: ActivityTone }> = {
  ORDER: { icon: 'layers3', tone: 'tone-blue' },
  QUOTE: { icon: 'file', tone: 'tone-cyan' },
  USER: { icon: 'users', tone: 'tone-blue' },
  MANUFACTURER: { icon: 'precision', tone: 'tone-magenta' },
  MANUFACTURING_REQUEST: { icon: 'cpu', tone: 'tone-purple' },
  CAD_FILE: { icon: 'cube', tone: 'tone-purple' },
  PAYMENT: { icon: 'wallet', tone: 'tone-green' },
  SHIPPING: { icon: 'send', tone: 'tone-blue' },
  PRICING_CONSTANT: { icon: 'gear', tone: 'tone-amber' },
  SETTING: { icon: 'configure', tone: 'tone-amber' },
};

const entryTitle = (entry: DashboardStats['activity'][number], t: TFunction): string => {
  const key = `admin.dashboard.activity.${entry.entityType.toLowerCase()}.${entry.action.toLowerCase()}`;
  return t(key, { defaultValue: t('admin.dashboard.activity.generic', { action: entry.action, entity: entry.entityType }) });
};

const timeAgo = (iso: string, t: TFunction): string => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return t('admin.dashboard.timeJustNow');
  if (minutes < 60) return t('admin.dashboard.timeMinutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('admin.dashboard.timeHoursAgo', { count: hours });
  return t('admin.dashboard.timeDaysAgo', { count: Math.floor(hours / 24) });
};

const shortId = (id: string): string => {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
};

export const RecentActivityList: React.FC<{
  items: DashboardStats['activity'];
  onViewAll: () => void;
}> = ({ items, onViewAll }) => {
  const { t } = useTranslation();

  return (
    <section className="widget" aria-label={t('admin.dashboard.recentActivity')}>
      <div className="widget-header">
        <h2 className="widget-title">{t('admin.dashboard.recentActivity')}</h2>
        <span className="widget-caption">{t('admin.dashboard.recentActivitySub')}</span>
        <button type="button" className="widget-link" onClick={onViewAll}>
          {t('admin.dashboard.viewAll')}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">{t('admin.dashboard.activityEmpty')}</div>
      ) : (
        <ul className="activity-list">
          {items.map((item) => {
            const meta = ENTITY_META[item.entityType] ?? { icon: 'clock' as IconName, tone: 'tone-blue' as ActivityTone };
            return (
              <li key={item.id} className={`activity-item ${meta.tone}`}>
                <span className="activity-icon" aria-hidden="true">
                  <Icon name={meta.icon} size={16} />
                </span>
                <span className="activity-body">
                  <span className="activity-title">{entryTitle(item, t)}</span>
                  <span className="activity-desc">
                    {item.actor ?? t('admin.dashboard.activity.system')}
                    {item.entityId ? ` · ${shortId(item.entityId)}` : ''}
                  </span>
                </span>
                <time className="activity-time" dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>
                  {timeAgo(item.createdAt, t)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};