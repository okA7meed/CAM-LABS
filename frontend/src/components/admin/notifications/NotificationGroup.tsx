import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminNotification } from '../../../types';
import { NotificationGroup as Group } from './notificationModel';
import { NotificationDestination } from '../../../utils/notificationUi';
import { NotificationRow } from './NotificationRow';

interface Props {
  group: Group;
  timeOf: (n: AdminNotification) => { primary: string; secondary: string };
  contextOf: (n: AdminNotification) => { label: string | null; value: string | null };
  destinationOf: (n: AdminNotification) => NotificationDestination;
  onOpen: (notification: AdminNotification) => void;
  onMarkRead: (id: string) => void;
  onNavigate: (destination: NotificationDestination) => void;
}

export const NotificationGroup: React.FC<Props> = ({ group, timeOf, contextOf, destinationOf, onOpen, onMarkRead, onNavigate }) => {
  const { t } = useTranslation();
  return (
    <section className="nc-group" aria-label={`${t(`admin.notifications.groups.${group.key}`)} (${group.count})`}>
      <div className="nc-group-head">
        <span className="nc-group-title">
          {t(`admin.notifications.groups.${group.key}`)}
          <span className="nc-group-count">{group.count > 99 ? '99+' : group.count}</span>
        </span>
        {group.dateLabel ? <span className="nc-group-date">{group.dateLabel}</span> : null}
      </div>
      <div className="nc-group-rows">
        {group.items.map((n) => {
          const time = timeOf(n);
          const context = contextOf(n);
          return (
            <NotificationRow
              key={n.id}
              notification={n}
              timePrimary={time.primary}
              timeSecondary={time.secondary}
              contextLabel={context.label}
              contextValue={context.value}
              destination={destinationOf(n)}
              onOpen={onOpen}
              onMarkRead={onMarkRead}
              onNavigate={onNavigate}
            />
          );
        })}
      </div>
    </section>
  );
};

export const NotificationEmptyState: React.FC<{ kind: 'loading' | 'empty' | 'filtered' | 'error'; message?: string | null; onRetry?: () => void }> = ({
  kind,
  message,
  onRetry,
}) => {
  const { t } = useTranslation();
  if (kind === 'loading') {
    return (
      <div className="nc-state" role="status" aria-label={t('admin.notifications.loading')}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="nc-skeleton-row" aria-hidden="true">
            <span className="nc-skeleton-ic" />
            <span className="nc-skeleton-lines">
              <span className="skeleton-block" style={{ width: '34%', height: 13 }} />
              <span className="skeleton-block" style={{ width: '72%', height: 11 }} />
            </span>
            <span className="skeleton-block nc-skeleton-time" style={{ width: 72, height: 11 }} />
          </div>
        ))}
      </div>
    );
  }
  const text =
    kind === 'error'
      ? message || t('admin.notifications.error')
      : kind === 'filtered'
        ? t('admin.notifications.emptySearch')
        : t('admin.notifications.empty');
  return (
    <div className="nc-state" role="status">
      <p className="nc-empty-text">{text}</p>
      {kind === 'error' && onRetry ? (
        <button type="button" className="cam-btn cam-btn-ghost" onClick={onRetry}>
          {t('admin.lists.retry')}
        </button>
      ) : null}
    </div>
  );
};
