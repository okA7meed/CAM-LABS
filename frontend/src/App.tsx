import React, { useEffect, useState } from 'react';
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

import { OrderCenter } from './components/orders/OrderCenter';
import { ProfileView } from './components/profile/ProfileView';
import { MarketplaceView } from './components/marketplace/MarketplaceView';
import { ManufacturingRequestView } from './components/manufacturing/ManufacturingWorkspaceView';
import { ComingSoonView } from './components/coming-soon/ComingSoonView';
import { EquationBuilderView } from './components/admin/EquationBuilderView';
import { NotFoundView } from './components/common/NotFoundView';
import { AdminDashboardView } from './components/admin/AdminDashboardView';
import { AdminOrdersView } from './components/admin/AdminOrdersView';
import { AdminCustomersView } from './components/admin/AdminCustomersView';
import { AdminManufacturersView } from './components/admin/AdminManufacturersView';
import { AdminManufacturingRequestsView } from './components/admin/AdminManufacturingRequestsView';
import { AdminMaterialsView } from './components/admin/AdminMaterialsView';
import { AdminQuotesView } from './components/admin/AdminQuotesView';
import { AdminCadFilesView } from './components/admin/AdminCadFilesView';
import { AdminOrderDetailView } from './components/admin/AdminOrderDetailView';
import { AdminCustomerDetailView } from './components/admin/AdminCustomerDetailView';
import { AdminManufacturerDetailView } from './components/admin/AdminManufacturerDetailView';
import { AdminManufacturingRequestDetailView } from './components/admin/AdminManufacturingRequestDetailView';
import { AdminQuoteDetailView } from './components/admin/AdminQuoteDetailView';
import { AdminCadFileDetailView } from './components/admin/AdminCadFileDetailView';
import { AdminPaymentsView } from './components/admin/AdminPaymentsView';
import { AdminShippingView } from './components/admin/AdminShippingView';
import { AdminReportsView } from './components/admin/AdminReportsView';
import { AdminNotificationsView } from './components/admin/AdminNotificationsView';
import { AdminUsersView } from './components/admin/AdminUsersView';
import { AdminAuditLogsView } from './components/admin/AdminAuditLogsView';
import { AdminSettingsView } from './components/admin/AdminSettingsView';
import { AdminPricingView } from './components/admin/AdminPricingView';

import { useStore } from './context/StoreContext';
import { useAuth } from './context/AuthContext';
import { ApiService } from './services/api';
import { useTranslation } from 'react-i18next';

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
      {!isLoading && activeView === 'not-found' && <NotFoundView />}
      {!isLoading && activeView === 'dashboard' && isAuthenticated && <OrderCenter />}
      {!isLoading && activeView === 'profile' && isAuthenticated && <ProfileView />}
      {!isLoading && activeView === 'marketplace' && <MarketplaceView />}
      {!isLoading && activeView === 'manufacturing-request' && <ManufacturingRequestView />}
      {!isLoading && activeView === 'coming-soon' && <ComingSoonView />}
      {!isLoading && activeView === 'equation-builder' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <EquationBuilderView />}

      {/* Admin Views */}
      {!isLoading && activeView === 'admin-dashboard' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminDashboardView />}
      {!isLoading && activeView === 'admin-orders' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminOrdersView />}
      {!isLoading && activeView === 'admin-order-detail' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminOrderDetailView />}
      {!isLoading && activeView === 'admin-customers' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminCustomersView />}
      {!isLoading && activeView === 'admin-customer-detail' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminCustomerDetailView />}
      {!isLoading && activeView === 'admin-manufacturers' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminManufacturersView />}
      {!isLoading && activeView === 'admin-manufacturer-detail' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminManufacturerDetailView />}
      {!isLoading && activeView === 'admin-manufacturing-requests' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminManufacturingRequestsView />}
      {!isLoading && activeView === 'admin-manufacturing-request-detail' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminManufacturingRequestDetailView />}
      {!isLoading && activeView === 'admin-materials' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminMaterialsView />}
      {!isLoading && activeView === 'admin-quotes' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminQuotesView />}
      {!isLoading && activeView === 'admin-quote-detail' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminQuoteDetailView />}
      {!isLoading && activeView === 'admin-cad-files' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminCadFilesView />}
      {!isLoading && activeView === 'admin-cad-file-detail' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminCadFileDetailView />}
      {!isLoading && activeView === 'admin-shipping' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminShippingView />}
      {!isLoading && activeView === 'admin-payments' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminPaymentsView />}
      {!isLoading && activeView === 'admin-reports' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminReportsView />}
      {!isLoading && activeView === 'admin-notifications' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminNotificationsView />}
      {!isLoading && activeView === 'admin-users' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminUsersView />}
      {!isLoading && activeView === 'admin-audit-logs' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminAuditLogsView />}
      {!isLoading && activeView === 'admin-settings' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminSettingsView />}
      {!isLoading && activeView === 'admin-pricing' && isAuthenticated && currentUser?.role?.includes('ADMIN') && <AdminPricingView />}

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
