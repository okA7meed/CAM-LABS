import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { ViewType } from '../../types';
import { Logo } from './Logo';
import { HeaderPreferences } from './HeaderPreferences';
import { UserAvatar, getUserAvatarColor } from '../ui/UserAvatar';
import { useTranslation } from 'react-i18next';
import { isRequestFlowView } from '../../constants/navigation';

interface HeaderProps {
  onToggleMobileNav: () => void;
}

// Sections tracked on the landing page for scroll-aware nav highlighting
const SCROLL_SECTIONS: Array<{ id: string; view: ViewType }> = [
  { id: 'hero-section', view: 'home' },
  { id: 'services-section', view: 'services' },
  { id: 'workflow-section', view: 'workflow' },
  { id: 'materials-section', view: 'materials' },
  { id: 'about', view: 'about' },
];

const NON_LANDING_VIEWS: ViewType[] = ['dashboard', 'profile', 'marketplace', 'manufacturing-request', 'coming-soon', 'equation-builder'];

export const Header: React.FC<HeaderProps> = ({ onToggleMobileNav }) => {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { activeView, setActiveView, startManufacturingRequest, openAuthModal } = useStore();
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isLandingView = !NON_LANDING_VIEWS.includes(activeView);
  const isInsideRequestFlow = isRequestFlowView(activeView);

  // Track the section currently sitting at the "activation line" just below the sticky header,
  // using a hairline IntersectionObserver root so exactly one section is active at a time.
  useEffect(() => {
    if (!isLandingView) return undefined;

    let observer: IntersectionObserver | null = null;
    let resizeTimeoutId: number | undefined;

    const attachObserver = () => {
      observer?.disconnect();

      const headerHeight = navRef.current?.closest('.cam-header')?.getBoundingClientRect().height ?? 72;
      const sections = SCROLL_SECTIONS
        .map((section) => ({ ...section, el: document.getElementById(section.id) }))
        .filter((section): section is typeof section & { el: HTMLElement } => !!section.el);

      if (sections.length === 0) return;

      const activationLine = headerHeight + 16;
      const bottomMargin = Math.max(window.innerHeight - activationLine - 2, 0);

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const match = sections.find((section) => section.el === entry.target);
            if (match) setActiveView(match.view);
          });
        },
        { rootMargin: `-${activationLine}px 0px -${bottomMargin}px 0px`, threshold: 0 }
      );

      sections.forEach((section) => observer!.observe(section.el));
    };

    const initialTimeoutId = window.setTimeout(attachObserver, 60);
    const handleResize = () => {
      window.clearTimeout(resizeTimeoutId);
      resizeTimeoutId = window.setTimeout(attachObserver, 150);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.clearTimeout(initialTimeoutId);
      window.clearTimeout(resizeTimeoutId);
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, [isLandingView, setActiveView]);

  const handleNavClick = (view: ViewType, sectionId?: string) => {
    // Admin users land on the admin dashboard when they click "Dashboard".
    if (view === 'dashboard' && currentUser?.role?.includes('ADMIN')) {
      window.location.href = '/admin';
      return;
    }
    setActiveView(view);
    if (view === 'dashboard' || view === 'profile') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      if (sectionId) {
        setTimeout(() => {
          const el = document.getElementById(sectionId);
          if (!el) return;
          const headerHeight = navRef.current?.closest('.cam-header')?.getBoundingClientRect().height ?? 72;
          const targetTop = el.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
          window.scrollTo({ top: targetTop, behavior: 'smooth' });
        }, 50);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const navigationItems: Array<{ label: string; view: ViewType; sectionId?: string }> = [
    { label: t('nav.home'), view: 'home' },
    { label: t('nav.services'), view: 'services', sectionId: 'services-section' },
    { label: t('nav.workflow'), view: 'workflow', sectionId: 'workflow-section' },
    { label: t('nav.manufacturing'), view: 'materials', sectionId: 'materials-section' },
    { label: t('nav.about'), view: 'about', sectionId: 'about' },
    { label: t('nav.marketplace'), view: 'marketplace' },
    { label: t('nav.dashboard'), view: 'dashboard' },
  ];

  return (
    <header className={`cam-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="container header-container">
        <a
          href="#home"
          className="brand-wrapper"
          onClick={(e) => {
            e.preventDefault();
            handleNavClick('home');
          }}
        >
          <Logo className="brand-logo" />
        </a>

        <nav className="desktop-nav" aria-label={t('nav.main')} ref={navRef}>
          {navigationItems.map(({ label, view, sectionId }) => (
            <a
              key={view}
              href={`#${sectionId || view}`}
              className="nav-link"
              aria-current={activeView === view ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                handleNavClick(view, sectionId);
              }}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="header-actions">
          <HeaderPreferences />
          {isAuthenticated && currentUser && (
            <button
              className="user-profile-chip"
              onClick={() => handleNavClick('profile')}
              aria-label={t('nav.accountMenuFor', { name: currentUser.name })}
              title={currentUser.name}
            >
              <UserAvatar name={currentUser.name} color={getUserAvatarColor(currentUser)} size="sm" />
              <span className="user-profile-name">{currentUser.name}</span>
            </button>
          )}

          {isAuthenticated ? (
            <>
              <button className="header-sign-in" onClick={() => handleNavClick('dashboard')}>{t('nav.dashboard')}</button>
              <button className="header-sign-in" onClick={() => void logout()}>{t('nav.signOut')}</button>
            </>
          ) : (
            <button
              className="header-sign-in"
              onClick={() => openAuthModal('login')}
            >
              {t('nav.signIn')}
            </button>
          )}

          {!isInsideRequestFlow && (
            <button
              className="header-cta cam-shine-auto"
              onClick={() => startManufacturingRequest()}
              id="header-start-manufacturing-btn"
              aria-label={t('nav.startManufacturing')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <span>{t('nav.startManufacturing')}</span>
            </button>
          )}

          <button
            className="mobile-nav-toggle"
            onClick={onToggleMobileNav}
            aria-label={t('nav.openMenu')}
          >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};
