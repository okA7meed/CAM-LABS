import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { ViewType } from '../../types';
import { Logo } from './Logo';
import { HeaderPreferences } from './HeaderPreferences';
import { useTranslation } from 'react-i18next';

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

const NON_LANDING_VIEWS: ViewType[] = ['dashboard', 'profile', 'marketplace', 'manufacturing-request'];

export const Header: React.FC<HeaderProps> = ({ onToggleMobileNav }) => {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { activeView, setActiveView, startManufacturingRequest, openAuthModal } = useStore();
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const linkRefs = useRef<Map<ViewType, HTMLAnchorElement | null>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false });

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isLandingView = !NON_LANDING_VIEWS.includes(activeView);

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

  // Slide the active-item indicator to the current nav link
  useLayoutEffect(() => {
    const updateIndicator = () => {
      const navEl = navRef.current;
      const activeLink = linkRefs.current.get(activeView);
      if (!navEl || !activeLink) {
        setIndicator((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }
      const navRect = navEl.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      const inset = 7;
      setIndicator({ left: linkRect.left - navRect.left + inset, width: linkRect.width - inset * 2, visible: true });
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeView]);

  const handleNavClick = (view: ViewType, sectionId?: string) => {
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
          <div className="network-status-badge">
            <span className="dot"></span>
            <span>{t('nav.productionOnline')}</span>
          </div>
        </a>

        <nav className="desktop-nav" aria-label={t('nav.main')} ref={navRef}>
          {navigationItems.map(({ label, view, sectionId }) => (
            <a
              key={view}
              ref={(el) => {
                linkRefs.current.set(view, el);
              }}
              href={`#${sectionId || view}`}
              className={`nav-link ${activeView === view ? 'active' : ''}`}
              aria-current={activeView === view ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                handleNavClick(view, sectionId);
              }}
            >
              {label}
            </a>
          ))}
          <span
            className="nav-active-indicator"
            aria-hidden="true"
            style={{
              transform: `translateX(${indicator.left}px)`,
              width: `${indicator.width}px`,
              opacity: indicator.visible ? 1 : 0,
            }}
          />
        </nav>

        <div className="header-actions">
          <HeaderPreferences />
          {isAuthenticated && currentUser && (
            <span className="persona-select-btn" aria-label="Authenticated account">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0066FF" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>{currentUser.name.split(' ')[0]} ({currentUser.role})</span>
            </span>
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
