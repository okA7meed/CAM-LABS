import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, IconName } from '../../ui/Icon';

export interface SummaryCounts {
  total: number;
  unread: number;
  quotes: number;
  quotesUnread: number;
  orders: number;
  ordersUnread: number;
  customers: number;
  customersUnread: number;
  system: number;
  systemUnread: number;
}

interface Props {
  counts: SummaryCounts;
}

/**
 * Five compact operational cards. Every number is real: totals and unread
 * sub-counts come from the server aggregation (same visibility scope as the
 * list). The right-side bars are a static decorative motif (identical on
 * every card, aria-hidden) — NOT analytics. No trend feed exists, and
 * fabricated sparklines would be dishonest data visualization.
 */
export const NotificationSummary: React.FC<Props> = ({ counts }) => {
  const { t } = useTranslation();
  const cards: Array<{
    key: string;
    icon: IconName;
    accent: string;
    label: string;
    value: number;
    unread: number;
  }> = [
    { key: 'total', icon: 'bell', accent: 'nc-accent-blue', label: t('admin.notifications.summary.total'), value: counts.total, unread: counts.unread },
    { key: 'quotes', icon: 'file', accent: 'nc-accent-blue', label: t('admin.notifications.summary.quotes'), value: counts.quotes, unread: counts.quotesUnread },
    { key: 'orders', icon: 'cube', accent: 'nc-accent-green', label: t('admin.notifications.summary.orders'), value: counts.orders, unread: counts.ordersUnread },
    { key: 'customers', icon: 'users', accent: 'nc-accent-purple', label: t('admin.notifications.summary.customers'), value: counts.customers, unread: counts.customersUnread },
    { key: 'system', icon: 'gear', accent: 'nc-accent-amber', label: t('admin.notifications.summary.system'), value: counts.system, unread: counts.systemUnread },
  ];
  return (
    <div className="nc-summary nc-summary-five" role="group" aria-label={t('admin.notifications.summary.label')}>
      {cards.map((card) => (
        <div key={card.key} className="nc-sum-card">
          <span className={`nc-sum-ic ${card.accent}`} aria-hidden="true">
            <Icon name={card.icon} size={18} />
          </span>
          <span className="nc-sum-text">
            <span className="nc-sum-label">{card.label}</span>
            <span className="nc-sum-value">{card.value}</span>
            <span className="nc-sum-sub">
              <span className="nc-sum-dot" aria-hidden="true" />
              {t('admin.notifications.summary.unreadCount', { count: card.unread })}
            </span>
          </span>
          <span className={`nc-sum-motif ${card.accent}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      ))}
    </div>
  );
};
