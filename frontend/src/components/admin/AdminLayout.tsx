import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { Icon, IconName } from '../ui/Icon';
import { ViewType } from '../../types';

interface NavItem {
  view?: ViewType;
  label?: string;
  icon?: IconName;
  separator?: boolean;
}

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title, subtitle }) => {
  const { currentUser, logout } = useAuth();
  const { activeView, setActiveView, showToast } = useStore();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await logout();
    setActiveView('home');
    window.history.replaceState({}, '', '/');
    showToast(t('admin.logoutSuccessTitle'), t('admin.logoutSuccessMessage'), 'info');
  };

  const navItems: NavItem[] = [
    { view: 'admin-dashboard', label: t('admin.nav.dashboard'), icon: 'layers' },
    { view: 'admin-orders', label: t('admin.nav.orders'), icon: 'layers' },
    { view: 'admin-quotes', label: t('admin.nav.quotes'), icon: 'file' },
    { view: 'admin-customers', label: t('admin.nav.customers'), icon: 'technology' },
    { view: 'admin-cad-files', label: t('admin.nav.cadFiles'), icon: 'cube' },
    { separator: true },
    { view: 'admin-manufacturers', label: t('admin.nav.manufacturers'), icon: 'technology' },
    { view: 'admin-manufacturing-requests', label: t('admin.nav.manufacturingRequests'), icon: 'cpu' },
    { view: 'admin-materials', label: t('admin.nav.materials'), icon: 'cube' },
    { separator: true },
    { view: 'admin-pricing', label: t('admin.nav.pricing'), icon: 'configure' },
    { view: 'admin-payments', label: t('admin.nav.payments'), icon: 'clipboard' },
    { view: 'admin-reports', label: t('admin.nav.reports'), icon: 'file' },
    { view: 'admin-notifications', label: t('admin.nav.notifications'), icon: 'alert' },
    { view: 'admin-shipping', label: t('admin.nav.shipping'), icon: 'send' },
    { separator: true },
    { view: 'admin-users', label: t('admin.nav.adminUsers'), icon: 'eye' },
    { view: 'admin-audit-logs', label: t('admin.nav.auditLogs'), icon: 'file' },
    { view: 'admin-settings', label: t('admin.nav.settings'), icon: 'configure' },
  ];

  const sidebarStyle: React.CSSProperties = {
    width: sidebarOpen ? '260px' : '0px',
    minWidth: sidebarOpen ? '260px' : '0px',
    background: 'var(--cam-surface-1)',
    borderInlineEnd: '1px solid var(--cam-border-subtle)',
    insetInlineStart: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'width 0.3s ease, min-width 0.3s ease',
    position: 'sticky',
    top: '0',
    height: '100vh',
    zIndex: 100,
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cam-bg)' }}>
      <div style={sidebarStyle}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--cam-border-subtle)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div role="img" aria-label={t('admin.logoAlt')} style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--cam-blue-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', color: '#fff', flexShrink: 0 }}>C</div>
            <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--cam-text-primary)', whiteSpace: 'nowrap' }}>{t('admin.brand')}</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--cam-text-muted)', whiteSpace: 'nowrap' }}>{t('admin.panel')}</div>
        </div>

        <nav aria-label={t('admin.panel')} id="admin-sidebar-nav" style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {navItems.map((item, idx) => {
            if (item.separator) {
              return <div key={`sep-${idx}`} style={{ height: '1px', background: 'var(--cam-border-subtle)', margin: '8px 16px' }} />;
            }
            return (
              <button
                key={item.view}
                aria-current={item.view === activeView ? 'page' : undefined}
                onClick={() => {
                  if (item.view) setActiveView(item.view);
                  if (window.innerWidth <= 768) setSidebarOpen(false);
                }}
                className="admin-nav-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'start',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon name={item.icon || 'layers'} size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--cam-border-subtle)' }}>
          <div style={{ fontSize: '12px', color: 'var(--cam-text-secondary)', marginBottom: '4px', whiteSpace: 'nowrap' }}>
            {currentUser?.name || t('admin.roleAdmin')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--cam-text-muted)', whiteSpace: 'nowrap' }}>
            {currentUser?.role || t('admin.roleAdmin')}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          background: 'var(--cam-surface-1)',
          borderBottom: '1px solid var(--cam-border-subtle)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={t('admin.toggleNav')}
              aria-expanded={sidebarOpen}
              aria-controls="admin-sidebar-nav"
              className="admin-nav-toggle"
              style={{
                background: 'var(--cam-surface-2)',
                border: '1px solid var(--cam-border-subtle)',
                borderRadius: '6px',
                padding: '6px 8px',
                cursor: 'pointer',
                color: 'var(--cam-text-secondary)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Icon name="menu" size={18} />
            </button>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--cam-text-primary)' }}>{title}</div>
              {subtitle && <div style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>{subtitle}</div>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => setActiveView('home')}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              <Icon name="arrowRight" size={12} /> {t('admin.goToWebsite')}
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={handleLogout}
              style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--cam-danger)' }}
            >
              <Icon name="alert" size={12} /> {t('admin.logout')}
            </button>
          </div>
        </header>

        <main style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
          {children}
        </main>
      </div>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="mobile-sidebar-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99,
            display: 'none',
          }}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .mobile-sidebar-overlay { display: block !important; }
        }
      `}</style>
    </div>
  );
};
