import React from 'react';
import { useStore } from '../../context/StoreContext';
import { ViewType } from '../../types';
import { useTranslation } from 'react-i18next';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
  const { setActiveView, startManufacturingRequest, openAuthModal } = useStore();
  const { t } = useTranslation();

  const handleLinkClick = (view: ViewType, sectionId?: string) => {
    setActiveView(view);
    onClose();
    if (view === 'dashboard' || view === 'profile') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className={`mobile-menu-drawer ${isOpen ? 'open' : ''}`}>
      <a
        href="#home"
        className="mobile-nav-link"
        onClick={(e) => {
          e.preventDefault();
          handleLinkClick('home');
        }}
      >
        {t('nav.home')}
      </a>
      <a
        href="#services"
        className="mobile-nav-link"
        onClick={(e) => {
          e.preventDefault();
          handleLinkClick('services', 'services-section');
        }}
      >
        {t('nav.services')}
      </a>
      <a
        href="#workflow"
        className="mobile-nav-link"
        onClick={(e) => {
          e.preventDefault();
          handleLinkClick('workflow', 'workflow-section');
        }}
      >
        {t('nav.workflow')}
      </a>
      <a
        href="#materials"
        className="mobile-nav-link"
        onClick={(e) => {
          e.preventDefault();
          handleLinkClick('materials', 'materials-section');
        }}
      >
        {t('nav.manufacturing')}
      </a>
      <a
        href="#about"
        className="mobile-nav-link"
        onClick={(e) => {
          e.preventDefault();
          handleLinkClick('about', 'about');
        }}
      >
        {t('nav.about')}
      </a>
      <a
        href="#marketplace"
        className="mobile-nav-link"
        onClick={(e) => {
          e.preventDefault();
          handleLinkClick('marketplace');
        }}
      >
        {t('nav.marketplace')}
      </a>
      <a
        href="#dashboard"
        className="mobile-nav-link"
        onClick={(e) => {
          e.preventDefault();
          handleLinkClick('dashboard');
        }}
      >
        {t('nav.dashboard')}
      </a>
      <a
        href="#profile"
        className="mobile-nav-link"
        onClick={(e) => {
          e.preventDefault();
          handleLinkClick('profile');
        }}
      >
        {t('nav.profile')}
      </a>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <button
          className="btn btn-primary cam-shine-auto"
          style={{ width: '100%' }}
          onClick={() => {
            onClose();
            startManufacturingRequest();
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          {t('nav.startManufacturing')}
        </button>
        <button
          className="btn btn-outline"
          style={{ width: '100%' }}
          onClick={() => {
            onClose();
            openAuthModal('login');
          }}
        >
          {t('nav.accountSignIn')}
        </button>
      </div>
    </div>
  );
};
