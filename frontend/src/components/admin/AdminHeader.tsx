import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useTheme, ThemePreference } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationsContext';
import { ADMIN_NAV_ITEMS } from '../../constants/adminNav';
import { Icon } from '../ui/Icon';
import { ViewType, AdminNotification } from '../../types';
import { notificationIcon, notificationPriorityColor, notificationTypeLabel, openNotificationTarget } from '../../utils/notificationUi';
import { formatRelativeTime } from '../../utils/relativeTime';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  onToggleSidebar: () => void;
}

const SunIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
);
const MoonIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.4 14.8A8.5 8.5 0 0 1 9.2 3.6 8.5 8.5 0 1 0 20.4 14.8Z" /></svg>
);

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

const THEME_OPTIONS: ThemePreference[] = ['light', 'dark', 'system'];

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle, onToggleSidebar }) => {
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();
  const { setActiveView, showToast, openAdminOrderDetail, openAdminQuoteDetail, openAdminCustomerDetail } = useStore();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const { notifications, unread, loading, streamConnected, error, refresh, markRead, markAllRead } = useNotifications();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ADMIN_NAV_ITEMS.filter((item) => {
      const label = t(item.labelKey).toLowerCase();
      return label.includes(q) || item.view.toLowerCase().includes(q);
    });
  }, [query, t]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!langOpen) return undefined;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!langRef.current?.contains(event.target as Node)) setLangOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLangOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [langOpen]);

  useEffect(() => {
    if (!themeOpen) return undefined;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!themeRef.current?.contains(event.target as Node)) setThemeOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setThemeOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [themeOpen]);

  useEffect(() => {
    if (!notifOpen) return undefined;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!notifRef.current?.contains(event.target as Node)) setNotifOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notifOpen]);

  const runSearch = (item?: ViewType) => {
    const view = item ?? results[0]?.view;
    if (view) {
      setActiveView(view);
      setQuery('');
      setOpen(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setActiveView('home');
    window.history.replaceState({}, '', '/');
    showToast(t('admin.logoutSuccessTitle'), t('admin.logoutSuccessMessage'), 'info');
  };

  const goToWebsite = () => {
    window.history.pushState({}, '', '/');
    setActiveView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToNotificationsPage = () => {
    setActiveView('admin-notifications');
    setNotifOpen(false);
  };

  const handleNotificationClick = (notification: AdminNotification) => {
    openNotificationTarget(notification, {
      markRead,
      openAdminOrderDetail,
      openAdminQuoteDetail,
      openAdminCustomerDetail,
      openNotificationsPage: goToNotificationsPage,
    });
    setNotifOpen(false);
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    showToast(t('admin.notifications.markAllRead'), '', 'success');
  };

  return (
    <header className="cam-admin-toolbar">
      <button
        type="button"
        className="cam-icon-btn cam-toolbar-burger"
        onClick={onToggleSidebar}
        aria-label={t('admin.toggleNav')}
        aria-expanded="true"
        aria-controls="admin-sidebar-nav"
      >
        <Icon name="menu" size={18} />
      </button>

      <div className="cam-toolbar-titles">
        <span className="cam-toolbar-title">{title}</span>
        {subtitle && <span className="cam-toolbar-subtitle">{subtitle}</span>}
      </div>

      <div className="cam-toolbar-actions">
        <div className="cam-search" ref={searchRef}>
          <span className="cam-search-icon"><Icon name="search" size={14} /></span>
          <input
            className="cam-search-input"
            type="search"
            placeholder={t('admin.searchPlaceholder')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                runSearch();
              }
              if (event.key === 'Escape') setOpen(false);
            }}
            aria-label={t('admin.searchPlaceholder')}
            aria-expanded={open}
          />
          {query && (
            <button
              type="button"
              className="cam-search-clear"
              aria-label={t('admin.searchClear')}
              onClick={() => {
                setQuery('');
                setOpen(false);
              }}
            >
              <Icon name="close" size={12} />
            </button>
          )}
          {open && query.trim() && (
            <div className="cam-search-pop" role="listbox" aria-label={t('admin.searchResultsTitle')}>
              {results.length > 0 ? (
                <>
                  <div className="cam-search-pop-label">{t('admin.searchResultsTitle')}</div>
                  {results.map((item) => (
                    <button
                      key={item.view}
                      type="button"
                      className="cam-search-result"
                      role="option"
                      onClick={() => runSearch(item.view)}
                    >
                      <span className="cam-nav-ic"><Icon name={item.icon} size={15} /></span>
                      {t(item.labelKey)}
                    </button>
                  ))}
                </>
              ) : (
                <div className="cam-search-empty">{t('admin.searchEmpty')}</div>
              )}
            </div>
          )}
        </div>

        <div className="cam-theme" ref={themeRef}>
          <button
            type="button"
            className="cam-icon-btn"
            aria-label={t('theme.color')}
            title={t('theme.color')}
            aria-haspopup="listbox"
            aria-expanded={themeOpen}
            onClick={() => setThemeOpen((value) => !value)}
          >
            {preference === 'dark' ? <MoonIcon /> : preference === 'light' ? <SunIcon /> : resolvedTheme === 'light' ? <SunIcon /> : <MoonIcon />}
          </button>
          {themeOpen && (
            <div className="cam-theme-pop" role="listbox" aria-label={t('theme.color')}>
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={preference === option}
                  className={`cam-theme-option ${preference === option ? 'active' : ''}`}
                  onClick={() => {
                    setPreference(option);
                    setThemeOpen(false);
                  }}
                >
                  <span className="cam-theme-ic">
                    {option === 'light' ? <SunIcon /> : option === 'dark' ? <MoonIcon /> : resolvedTheme === 'light' ? <SunIcon /> : <MoonIcon />}
                  </span>
                  <span className="cam-theme-label">{t(`theme.${option}`)}</span>
                  {preference === option && (
                    <span className="cam-theme-check" aria-hidden="true">
                      <Icon name="check" size={13} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="cam-lang" ref={langRef}>
          <button
            type="button"
            className="cam-icon-btn"
            aria-label={t('admin.language')}
            title={t('admin.language')}
            aria-haspopup="listbox"
            aria-expanded={langOpen}
            onClick={() => setLangOpen((value) => !value)}
          >
            <Icon name="globe" size={17} />
          </button>
          {langOpen && (
            <div className="cam-lang-pop" role="listbox" aria-label={t('admin.language')}>
              {LANGUAGES.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  role="option"
                  aria-selected={i18n.language.startsWith(language.code)}
                  className={`cam-lang-option ${i18n.language.startsWith(language.code) ? 'active' : ''}`}
                  onClick={() => {
                    void i18n.changeLanguage(language.code);
                    setLangOpen(false);
                  }}
                >
                  <span className="cam-lang-code">{language.code.toUpperCase()}</span>
                  <span className="cam-lang-label">{language.label}</span>
                  {i18n.language.startsWith(language.code) && (
                    <span className="cam-lang-check" aria-hidden="true">
                      <Icon name="check" size={13} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="cam-notif" ref={notifRef}>
          <button
            type="button"
            className="cam-icon-btn cam-notif-btn"
            onClick={() => setNotifOpen((value) => !value)}
            aria-label={unread > 0 ? t('admin.notificationsUnread', { count: unread }) : t('admin.nav.notifications')}
            title={unread > 0 ? t('admin.notificationsUnread', { count: unread }) : t('admin.nav.notifications')}
            aria-haspopup="dialog"
            aria-expanded={notifOpen}
          >
            <Icon name="bell" size={17} />
            <span className={`notif-live ${streamConnected ? 'on' : ''}`} aria-hidden="true" title={streamConnected ? t('admin.notifications.streamConnected') : t('admin.notifications.streamDisabled')} />
            {unread > 0 && <span className="notif-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
          </button>
          {notifOpen && (
            <div className="cam-notif-pop" role="dialog" aria-label={t('admin.notifications.title')}>
              <div className="cam-notif-head">
                <span className="cam-notif-title">{t('admin.notifications.title')}</span>
                <button
                  type="button"
                  className="cam-notif-markall"
                  onClick={() => void handleMarkAllRead()}
                  disabled={unread === 0}
                  title={t('admin.notifications.markAllRead')}
                >
                  {t('admin.notifications.markAllRead')}
                </button>
              </div>
              <div className="cam-notif-body">
                {loading ? (
                  <div className="cam-notif-skeleton">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="cam-notif-skeleton-item">
                        <span className="skeleton-block cam-notif-skeleton-ic" />
                        <div className="cam-notif-skeleton-copy">
                          <span className="skeleton-block" style={{ width: '70%', height: 12 }} />
                          <span className="skeleton-block" style={{ width: '45%', height: 10 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : error && notifications.length === 0 ? (
                  <div className="cam-notif-state">
                    <span className="cam-notif-state-icon"><Icon name="alert" size={16} /></span>
                    <span className="cam-notif-state-text">{t('admin.notifications.error')}</span>
                    <button type="button" className="cam-notif-retry" onClick={() => void refresh()}>{t('admin.lists.retry')}</button>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="cam-notif-state">
                    <span className="cam-notif-state-icon"><Icon name="bell" size={16} /></span>
                    <span className="cam-notif-state-text">{t('admin.notifications.empty')}</span>
                  </div>
                ) : (
                  <ul className="cam-notif-list">
                    {notifications.map((notification) => (
                      <li key={notification.id}>
                        <button
                          type="button"
                          className={`cam-notif-item ${notification.isRead ? 'read' : 'unread'}`}
                          onClick={() => handleNotificationClick(notification)}
                          title={t('admin.notifications.markRead')}
                        >
                          <span className="cam-notif-ic" style={{ color: notificationPriorityColor(notification.priority) }}>
                            <Icon name={notificationIcon(notification.type)} size={16} />
                          </span>
                          <span className="cam-notif-copy">
                            <span className="cam-notif-line">
                              <span className="cam-notif-type">{notificationTypeLabel(notification.type, t)}</span>
                              <span className="cam-notif-time">{formatRelativeTime(notification.createdAt, i18n.language)}</span>
                            </span>
                            <span className="cam-notif-title-text">{notification.title}</span>
                            <span className="cam-notif-msg">{notification.message}</span>
                          </span>
                          {!notification.isRead && <span className="cam-notif-unread-dot" aria-hidden="true" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="button" className="cam-notif-viewall" onClick={goToNotificationsPage}>
                {t('admin.notifications.viewAll')}
                <Icon name="chevronRight" size={13} />
              </button>
            </div>
          )}
        </div>

        <button type="button" className="cam-btn cam-btn-outline" onClick={goToWebsite} title={t('admin.goToWebsite')}>
          <Icon name="arrowRight" size={13} />
          <span className="cta-label">{t('admin.goToWebsite')}</span>
        </button>

        <button type="button" className="cam-btn cam-btn-ghost" onClick={() => void handleLogout()} title={t('admin.logout')}>
          <Icon name="arrowRight" size={13} />
          <span className="cta-label">{t('admin.logout')}</span>
        </button>
      </div>
    </header>
  );
};