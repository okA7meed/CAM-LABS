import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../ui/Icon';
import { AdminNotification } from '../../../types';
import {
  NOTIFICATION_CATEGORY_META,
  NotificationDestination,
  notificationCategoryOf,
} from '../../../utils/notificationUi';

interface Props {
  notification: AdminNotification;
  timePrimary: string;
  timeSecondary: string;
  contextLabel: string | null;
  contextValue: string | null;
  destination: NotificationDestination;
  onOpen: (notification: AdminNotification) => void;
  onMarkRead: (id: string) => void;
  onNavigate: (destination: NotificationDestination) => void;
}

export const NotificationRow: React.FC<Props> = ({
  notification,
  timePrimary,
  timeSecondary,
  contextLabel,
  contextValue,
  destination,
  onOpen,
  onMarkRead,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const category = notificationCategoryOf(notification);
  const meta = NOTIFICATION_CATEGORY_META[category];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const focusItem = (index: number) => {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    if (items.length === 0) return;
    const next = ((index % items.length) + items.length) % items.length;
    items[next]?.focus();
  };

  const menuItems: Array<{ key: string; label: string; run: () => void }> = [];
  if (!notification.isRead) {
    menuItems.push({
      key: 'read',
      label: t('admin.notifications.markRead'),
      run: () => onMarkRead(notification.id),
    });
  }
  if (destination.viewLabelKey) {
    menuItems.push({
      key: 'open',
      label: t(destination.viewLabelKey),
      run: () => onNavigate(destination),
    });
  }

  return (
    <article
      className={`nc-row${notification.isRead ? '' : ' nc-unread'}`}
      aria-label={`${notification.title}. ${notification.isRead ? t('admin.notifications.stateRead') : t('admin.notifications.stateUnread')}`}
    >
      <button type="button" className="nc-row-open" onClick={() => onOpen(notification)} aria-label={`${notification.title} — ${destination.viewLabelKey ? t(destination.viewLabelKey) : t('admin.notifications.open')}`}>
        <span className={`nc-ic nc-accent-${meta.accent}`} aria-hidden="true">
          <Icon name={meta.icon} size={18} />
        </span>
        {!notification.isRead ? (
          <span className="nc-dot" aria-hidden="true" title={t('admin.notifications.stateUnread')} />
        ) : (
          <span className="nc-dot-slot" aria-hidden="true" />
        )}
        <span className="nc-main">
          <span className="nc-title">{notification.title}</span>
          <span className="nc-desc">{notification.message}</span>
        </span>
        {contextValue ? (
          <span className="nc-context">
            {contextLabel ? <span className="nc-context-label">{contextLabel}</span> : null}
            <span className="nc-context-value">{contextValue}</span>
          </span>
        ) : null}
        <span className="nc-time">
          <span className="nc-time-primary">{timePrimary}</span>
          <span className="nc-time-secondary">{timeSecondary}</span>
        </span>
      </button>
      <span className="nc-row-actions">
        {destination.viewLabelKey ? (
          <button
            type="button"
            className="nc-view"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(destination);
            }}
          >
            {t(destination.viewLabelKey)}
          </button>
        ) : null}
        {menuItems.length > 0 ? (
          <span className="nc-menu-wrap" ref={menuRef}>
            <button
              ref={toggleRef}
              type="button"
              className="nc-overflow"
              aria-label={t('admin.notifications.moreActions')}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !menuOpen) {
                  e.preventDefault();
                  setMenuOpen(true);
                  window.setTimeout(() => focusItem(0), 0);
                }
              }}
            >
              <Icon name="dotsVertical" size={15} />
            </button>
            {menuOpen ? (
              <span className="nc-menu" role="menu" aria-label={notification.title}>
                {menuItems.map((item, index) => (
                  <button
                    key={item.key}
                    ref={(node) => {
                      itemRefs.current[index] = node;
                    }}
                    type="button"
                    role="menuitem"
                    className="nc-menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      item.run();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        focusItem(index + 1);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        focusItem(index - 1);
                      }
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
    </article>
  );
};
