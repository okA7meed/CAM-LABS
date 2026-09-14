import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { MobileNav } from './components/layout/MobileNav';
import { ToastContainer } from './components/layout/ToastContainer';

import { HeroSection } from './components/home/HeroSection';
import { ServicesSection } from './components/home/ServicesSection';
import { WorkflowSection } from './components/home/WorkflowSection';
import { CapabilitiesSection } from './components/home/CapabilitiesSection';
import { AboutSection } from './components/home/AboutSection';
import { CtaBanner } from './components/home/CtaBanner';
import { MarketplaceSection } from './components/home/MarketplaceSection';

import { MaterialsExplorer } from './components/explorer/MaterialsExplorer';
import { ComparisonDrawer } from './components/explorer/ComparisonDrawer';
import { ComparisonModal } from './components/explorer/ComparisonModal';

import { AuthModal } from './components/auth/AuthModal';
import { PersonaModal } from './components/auth/PersonaModal';
import { ForgotPasswordModal } from './components/auth/ForgotPasswordModal';

import { useStore } from './context/StoreContext';
import { useAuth } from './context/AuthContext';
import { ApiService } from './services/api';
import { useTranslation } from 'react-i18next';

/*
 * Heavy and/or rarely-visited views are code-split so the marketing root stays
 * dependency-light. The Manufacturing workspace and the admin console pull in
 * the three.js vendors (see vite.config.ts `vendor-cad`), which are therefore
 * only downloaded when the user actually reaches those surfaces.
 */
const NotFoundView = lazy(() => import('./components/common/NotFoundView').then((m) => ({ default: m.NotFoundView })));
const OrderCenter = lazy(() => import('./components/orders/OrderCenter').then((m) => ({ default: m.OrderCenter })));
const ProfileView = lazy(() => import('./components/profile/ProfileView').then((m) => ({ default: m.ProfileView })));
const MarketplaceView = lazy(() => import('./components/marketplace/MarketplaceView').then((m) => ({ default: m.MarketplaceView })));
const ManufacturingRequestView = lazy(() => import('./components/manufacturing/ManufacturingWorkspaceView').then((m) => ({ default: m.ManufacturingRequestView })));
const ComingSoonView = lazy(() => import('./components/coming-soon/ComingSoonView').then((m) => ({ default: m.ComingSoonView })));
const EquationBuilderView = lazy(() => import('./components/admin/EquationBuilderView').then((m) => ({ default: m.EquationBuilderView })));
const AdminDashboardView = lazy(() => import('./components/admin/AdminDashboardView').then((m) => ({ default: m.AdminDashboardView })));
const AdminOrdersView = lazy(() => import('./components/admin/AdminOrdersView').then((m) => ({ default: m.AdminOrdersView })));
const AdminCustomersView = lazy(() => import('./components/admin/AdminCustomersView').then((m) => ({ default: m.AdminCustomersView })));
const AdminManufacturersView = lazy(() => import('./components/admin/AdminManufacturersView').then((m) => ({ default: m.AdminManufacturersView })));
const AdminManufacturingRequestsView = lazy(() => import('./components/admin/AdminManufacturingRequestsView').then((m) => ({ default: m.AdminManufacturingRequestsView })));
const AdminMaterialsView = lazy(() => import('./components/admin/AdminMaterialsView').then((m) => ({ default: m.AdminMaterialsView })));
const AdminQuotesView = lazy(() => import('./components/admin/AdminQuotesView').then((m) => ({ default: m.AdminQuotesView })));
const AdminCadFilesView = lazy(() => import('./components/admin/AdminCadFilesView').then((m) => ({ default: m.AdminCadFilesView })));
const AdminOrderDetailView = lazy(() => import('./components/admin/AdminOrderDetailView').then((m) => ({ default: m.AdminOrderDetailView })));
const AdminCustomerDetailView = lazy(() => import('./components/admin/AdminCustomerDetailView').then((m) => ({ default: m.AdminCustomerDetailView })));
const AdminManufacturerDetailView = lazy(() => import('./components/admin/AdminManufacturerDetailView').then((m) => ({ default: m.AdminManufacturerDetailView })));
const AdminManufacturingRequestDetailView = lazy(() => import('./components/admin/AdminManufacturingRequestDetailView').then((m) => ({ default: m.AdminManufacturingRequestDetailView })));
const AdminQuoteDetailView = lazy(() => import('./components/admin/AdminQuoteDetailView').then((m) => ({ default: m.AdminQuoteDetailView })));
const AdminCadFileDetailView = lazy(() => import('./components/admin/AdminCadFileDetailView').then((m) => ({ default: m.AdminCadFileDetailView })));
const AdminPaymentsView = lazy(() => import('./components/admin/AdminPaymentsView').then((m) => ({ default: m.AdminPaymentsView })));
const AdminShippingView = lazy(() => import('./components/admin/AdminShippingView').then((m) => ({ default: m.AdminShippingView })));
const AdminReportsView = lazy(() => import('./components/admin/AdminReportsView').then((m) => ({ default: m.AdminReportsView })));
const AdminNotificationsView = lazy(() => import('./components/admin/AdminNotificationsView').then((m) => ({ default: m.AdminNotificationsView })));
const AdminUsersView = lazy(() => import('./components/admin/AdminUsersView').then((m) => ({ default: m.AdminUsersView })));
const AdminAuditLogsView = lazy(() => import('./components/admin/AdminAuditLogsView').then((m) => ({ default: m.AdminAuditLogsView })));
const AdminSettingsView = lazy(() => import('./components/admin/AdminSettingsView').then((m) => ({ default: m.AdminSettingsView })));
const AdminPricingView = lazy(() => import('./components/admin/AdminPricingView').then((m) => ({ default: m.AdminPricingView })));

const ViewLoader: React.FC = () => (
  <main id="view-loading"><div className="container loading-state"><div className="skeleton loading-state-mark" /></div></main>
);

export const App: React.FC = () => {
  const { activeView, setActiveView, closeAuthModal, closePersonaModal, closeForgotPassword, closeComparisonModal, closeOrderTimeline } = useStore();
  const { isLoading, isAuthenticated, currentUser } = useAuth();
  const { t } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [adminBasePath, setAdminBasePath] = useState('/admin');

  const isAdminView = !isLoading && activeView.startsWith('admin-');

  useEffect(() => {
    if (!isLoading && isAuthenticated && currentUser?.role?.includes('ADMIN')) {
      ApiService.getAdminUrl()
        .then((result) => {
          if (result?.adminUrl) setAdminBasePath(result.adminUrl);
        })
        .catch(() => undefined);
    }
  }, [currentUser?.role, isAuthenticated, isLoading]);

  useEffect(() => {
    if (isLoading) return;

    const isAdmin = isAuthenticated && Boolean(currentUser?.role?.includes('ADMIN'));
    const isAtAdminRoute = window.location.pathname.startsWith(adminBasePath) || window.location.pathname.startsWith('/admin');

    if (isAtAdminRoute) {
      if (isAdmin) {
        if (!activeView.startsWith('admin-')) {
          setActiveView('admin-dashboard');
        }
      } else {
        if (activeView !== 'not-found') {
          setActiveView('not-found');
        }
      }
    } else {
      if (activeView.startsWith('admin-')) {
        setActiveView('home');
      }
    }
  }, [adminBasePath, currentUser?.role, isAuthenticated, isLoading, setActiveView]);

  useEffect(() => {
    const handlePopState = () => {
      if (isLoading) return;
      const isAdmin = isAuthenticated && Boolean(currentUser?.role?.includes('ADMIN'));
      const isAtAdminRoute = window.location.pathname.startsWith(adminBasePath) || window.location.pathname.startsWith('/admin');

      if (isAtAdminRoute) {
        if (isAdmin) {
          if (!activeView.startsWith('admin-')) {
            setActiveView('admin-dashboard');
          }
        } else {
          setActiveView('not-found');
        }
      } else {
        if (activeView.startsWith('admin-') || activeView === 'not-found') {
          setActiveView('home');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeView, adminBasePath, currentUser?.role, isAuthenticated, isLoading, setActiveView]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileNavOpen(false);
      closeAuthModal();
      closePersonaModal();
      closeForgotPassword();
      closeComparisonModal();
      closeOrderTimeline();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [closeAuthModal, closeComparisonModal, closeForgotPassword, closeOrderTimeline, closePersonaModal]);

  useEffect(() => {
    document.body.style.overflow = activeView === 'manufacturing-request' ? 'hidden' : '';
  }, [activeView]);

  return (
    <div className={`${isAdminView ? '' : 'tech-grid-bg'} page-enter${activeView === 'manufacturing-request' ? ' app-viewport' : ''}`} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!isAdminView && <Header onToggleMobileNav={() => setMobileNavOpen(!mobileNavOpen)} />}
      {!isAdminView && <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />}

      {isLoading && <main id="view-loading"><div className="container loading-state"><div className="skeleton loading-state-mark" /><p>{t('status.resolvingSession')}</p></div></main>}
      {!isLoading && (
        <Suspense fallback={<ViewLoader />}>
          {activeView === 'not-found' && <NotFoundView />}
          {activeView === 'dashboard' && isAuthenticated && <OrderCenter />}
          {activeView === 'profile' && isAuthenticated && <ProfileView />}
          {activeView === 'marketplace' && <MarketplaceView />}
          {activeView === 'manufacturing-request' && <ManufacturingRequestView />}
          {activeView === 'coming-soon' && <ComingSoonView />}
          {activeView === 'equation-builder' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <EquationBuilderView />}

          {/* Admin Views */}
          {activeView === 'admin-dashboard' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminDashboardView />}
          {activeView === 'admin-orders' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminOrdersView />}
          {activeView === 'admin-order-detail' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminOrderDetailView />}
          {activeView === 'admin-customers' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminCustomersView />}
          {activeView === 'admin-customer-detail' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminCustomerDetailView />}
          {activeView === 'admin-manufacturers' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminManufacturersView />}
          {activeView === 'admin-manufacturer-detail' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminManufacturerDetailView />}
          {activeView === 'admin-manufacturing-requests' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminManufacturingRequestsView />}
          {activeView === 'admin-manufacturing-request-detail' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminManufacturingRequestDetailView />}
          {activeView === 'admin-materials' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminMaterialsView />}
          {activeView === 'admin-quotes' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminQuotesView />}
          {activeView === 'admin-quote-detail' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminQuoteDetailView />}
          {activeView === 'admin-cad-files' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminCadFilesView />}
          {activeView === 'admin-cad-file-detail' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminCadFileDetailView />}
          {activeView === 'admin-shipping' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminShippingView />}
          {activeView === 'admin-payments' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminPaymentsView />}
          {activeView === 'admin-reports' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminReportsView />}
          {activeView === 'admin-notifications' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminNotificationsView />}
          {activeView === 'admin-users' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminUsersView />}
          {activeView === 'admin-audit-logs' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminAuditLogsView />}
          {activeView === 'admin-settings' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminSettingsView />}
          {activeView === 'admin-pricing' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminPricingView />}
        </Suspense>
      )}

      {!isLoading && activeView !== 'marketplace' && activeView !== 'manufacturing-request' && activeView !== 'coming-soon' && activeView !== 'equation-builder' && activeView !== 'not-found' && !activeView.startsWith('admin-') && (activeView !== 'dashboard' || !isAuthenticated) && (activeView !== 'profile' || !isAuthenticated) && (
        <main id="view-landing">
          <HeroSection />
          <ServicesSection />
          <WorkflowSection />
          <MaterialsExplorer />
          <CapabilitiesSection />
          <AboutSection />
          <CtaBanner />
          <MarketplaceSection />
        </main>
      )}

      {!isLoading && !isAdminView && activeView !== 'manufacturing-request' && <Footer />}

      {/* Interactive Global Overlays & Modals */}
      <AuthModal />
      <PersonaModal />
      <ForgotPasswordModal />
      <ComparisonModal />
      <ComparisonDrawer />
      <ToastContainer />
    </div>
  );
};
