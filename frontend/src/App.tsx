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

import { DashboardView } from './components/dashboard/DashboardView';
import { ProfileView } from './components/profile/ProfileView';
import { MarketplaceView } from './components/marketplace/MarketplaceView';
import { ManufacturingRequestView } from './components/manufacturing/ManufacturingRequestView';

import { useStore } from './context/StoreContext';
import { useAuth } from './context/AuthContext';
import { useTranslation } from 'react-i18next';

export const App: React.FC = () => {
  const { activeView, closeAuthModal, closePersonaModal, closeForgotPassword, closeComparisonModal, closeOrderTimeline } = useStore();
  const { isLoading, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  return (
    <div className="tech-grid-bg page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header onToggleMobileNav={() => setMobileNavOpen(!mobileNavOpen)} />
      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {isLoading && <main id="view-loading"><div className="container loading-state"><div className="skeleton loading-state-mark" /><p>{t('status.resolvingSession')}</p></div></main>}
      {!isLoading && activeView === 'dashboard' && isAuthenticated && <DashboardView />}
      {!isLoading && activeView === 'profile' && isAuthenticated && <ProfileView />}
      {!isLoading && activeView === 'marketplace' && <MarketplaceView />}
      {!isLoading && activeView === 'manufacturing-request' && <ManufacturingRequestView />}
      {!isLoading && activeView !== 'marketplace' && activeView !== 'manufacturing-request' && (activeView !== 'dashboard' || !isAuthenticated) && (activeView !== 'profile' || !isAuthenticated) && (
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

      <Footer />

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
