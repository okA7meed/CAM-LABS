import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../ui/Icon';
import { DateRange, NOTIFICATION_TABS, NotificationTab } from './notificationModel';

interface Props {
  tab: NotificationTab;
  onTab: (tab: NotificationTab) => void;
  counts: Record<NotificationTab, number>;
  query: string;
  onQuery: (query: string) => void;
  range: DateRange;
  onRange: (range: DateRange) => void;
  onMarkAllRead: () => void;
  markAllDisabled: boolean;
}

const RANGES: DateRange[] = ['all', 'today', 'yesterday', 'last7', 'last30'];

export const NotificationToolbar: React.FC<Props> = ({
  tab,
  onTab,
  counts,
  query,
  onQuery,
  range,
  onRange,
  onMarkAllRead,
  markAllDisabled,
}) => {
  const { t } = useTranslation();
  return (
    <div className="nc-toolbar">
      <div className="nc-search">
        <Icon name="search" size={15} className="nc-search-icon" />
        <input
          className="nc-search-input"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t('admin.notifications.searchPlaceholder')}
          aria-label={t('admin.notifications.searchLabel')}
        />
        {query && (
          <button type="button" className="nc-search-clear" onClick={() => onQuery('')} aria-label={t('admin.notifications.searchClear')}>
            <Icon name="close" size={13} />
          </button>
        )}
      </div>
      <div className="nc-tabs" role="tablist" aria-label={t('admin.notifications.title')}>
        {NOTIFICATION_TABS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`nc-tab${tab === value ? ' active' : ''}`}
            onClick={() => onTab(value)}
          >
            {t(`admin.notifications.filters.${value}`)}
            <span className="nc-tab-count" aria-label={`${counts[value]}`}>
              {counts[value] > 99 ? '99+' : counts[value]}
            </span>
          </button>
        ))}
      </div>
      <div className="nc-toolbar-side">
        <label className="nc-range">
          <span className="af-sr-only">{t('admin.notifications.rangeLabel')}</span>
          <Icon name="calendar" size={14} className="nc-range-icon" />
          <select
            className="nc-range-select"
            value={range}
            onChange={(e) => onRange(e.target.value as DateRange)}
            aria-label={t('admin.notifications.rangeLabel')}
          >
            {RANGES.map((value) => (
              <option key={value} value={value}>
                {t(`admin.notifications.range.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="nc-markall"
          onClick={onMarkAllRead}
          disabled={markAllDisabled}
        >
          <Icon name="check" size={13} />
          <span>{t('admin.notifications.markAllRead')}</span>
        </button>
      </div>
    </div>
  );
};
