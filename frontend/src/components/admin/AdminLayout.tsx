import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { ViewType } from '../../types';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const DESKTOP_BREAKPOINT = 1023;

const isCompactViewport = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${DESKTOP_BREAKPOINT}px)`).matches;
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title, subtitle }) => {
  const { setActiveView } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleToggleSidebar = () => {
    if (isCompactViewport()) {
      setDrawerOpen((current) => !current);
    } else {
      setCollapsed((current) => !current);
    }
  };

  const handleNavigate = (view: ViewType) => {
    setActiveView(view);
    if (isCompactViewport()) setDrawerOpen(false);
  };

  return (
    <div className={`cam-admin ${collapsed ? 'sidebar-collapsed' : ''} ${drawerOpen ? 'sidebar-drawer-open' : ''}`}>
      <AdminSidebar collapsed={collapsed} onNavigate={handleNavigate} onToggle={handleToggleSidebar} />
      <div className="cam-sidebar-overlay" onClick={() => setDrawerOpen(false)} aria-hidden="true" />

      <div className="cam-admin-main">
        <AdminHeader
          title={title}
          subtitle={subtitle}
          onToggleSidebar={handleToggleSidebar}
        />
        <main className="cam-admin-content">{children}</main>
      </div>
    </div>
  );
};