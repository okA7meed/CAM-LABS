import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { ADMIN_NAV_GROUPS } from '../../constants/adminNav';
import { Icon, IconName } from '../ui/Icon';
import { UserAvatar, getUserAvatarColor } from '../ui/UserAvatar';
import { ViewType } from '../../types';

interface AdminSidebarProps {
  collapsed: boolean;
  onNavigate: (view: ViewType) => void;
  onToggle?: () => void;
}

const CollapseGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ onNavigate, onToggle }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { activeView } = useStore();
  const userName = currentUser?.name || t('admin.roleAdmin');
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/v1/admin/notifications/unread-count', { credentials: 'same-origin' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (alive) setUnread(Number(data?.data?.count) || 0);
        })
        .catch(() => undefined);
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const renderItem = (view: ViewType, labelKey: string, icon: IconName) => {
    const isActive = view === activeView;
    const showDot = view === 'admin-notifications' && unread > 0;
    return (
      <button
        key={view}
        type="button"
        className={`cam-nav-item ${isActive ? 'active' : ''}`}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onNavigate(view)}
      >
        <span className="cam-nav-ic" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <span className="cam-nav-label">{t(labelKey)}</span>
        {showDot ? (
          <span className="cam-nav-dot" aria-label={t('admin.notificationsUnread', { count: unread })} />
        ) : (
          <span className="cam-nav-chev" aria-hidden="true">
            <Icon name="chevronRight" size={14} />
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className="cam-sidebar" aria-label={t('admin.panel')}>
      <div className="cam-brand">
        <div className="cam-brand-row">
          <span className="cam-brand-mark" role="img" aria-label={t('admin.logoAlt')}>C</span>
          <span className="cam-brand-text-wrap">
            <span className="cam-brand-text">{t('admin.brand')}</span>
            <span className="cam-brand-sub">{t('admin.panel')}</span>
          </span>
          {onToggle && (
            <button
              type="button"
              className="cam-brand-toggle"
              onClick={onToggle}
              aria-label={t('admin.toggleNav')}
              title={t('admin.toggleNav')}
            >
              <CollapseGlyph />
            </button>
          )}
        </div>
      </div>

      <nav className="cam-sidebar-nav" aria-label={t('admin.panel')} id="admin-sidebar-nav">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.id} className="cam-nav-group">
            <div className="cam-nav-group-title">{t(group.labelKey)}</div>
            {group.items.map((item) => renderItem(item.view, item.labelKey, item.icon))}
          </div>
        ))}
      </nav>

      <div className="cam-profile">
        <UserAvatar name={userName} color={getUserAvatarColor(currentUser)} size="sm" />
        <span className="cam-profile-meta">
          <span className="cam-profile-name">{userName}</span>
          <span className="cam-profile-role">{t('admin.roleAdmin')}</span>
        </span>
        <span className="cam-profile-chev" aria-hidden="true">
          <Icon name="chevronRight" size={14} />
        </span>
      </div>
    </aside>
  );
};