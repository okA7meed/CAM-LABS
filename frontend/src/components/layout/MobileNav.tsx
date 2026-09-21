import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ViewType } from '../../types';
import { useTranslation } from 'react-i18next';
import { isRequestFlowView } from '../../constants/navigation';
import { enterAdminPath, resetPathname } from '../../routing/hashRouter';
import { Icon, IconName } from '../ui/Icon';
import { Logo } from './Logo';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavEntry {
  icon: IconName;
  labelKey: string;
  view: ViewType;
  sectionId?: string;
  href: string;
}

// Single source of truth for the drawer navigation rows. Destinations and
// auth-conditional entries mirror the previous implementation exactly.
const NAV_ENTRIES: NavEntry[] = [
  { icon: 'home', labelKey: 'nav.home', view: 'home', href: '#home' },
  { icon: 'cube', labelKey: 'nav.services', view: 'services', sectionId: 'services-section', href: '#services' },
  { icon: 'gear', labelKey: 'nav.workflow', view: 'workflow', sectionId: 'workflow-section', href: '#workflow' },
  { icon: 'factory', labelKey: 'nav.manufacturing', view: 'materials', sectionId: 'materials-section', href: '#materials' },
  { icon: 'users', labelKey: 'nav.about', view: 'about', sectionId: 'about', href: '#about' },
  { icon: 'cart', labelKey: 'nav.marketplace', view: 'marketplace', href: '#marketplace' },
  { icon: 'chart', labelKey: 'nav.dashboard', view: 'dashboard', href: '#dashboard' },
  { icon: 'userRound', labelKey: 'nav.profile', view: 'profile', href: '#profile' },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
  const { setActiveView, activeView, startManufacturingRequest, openAuthModal } = useStore();
  const { subView, openFavorites, openCart, favorites, itemCount } = useMarketplace();
  const { currentUser, isAuthenticated } = useAuth();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const prevOverflowRef = useRef<string>('');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Explicit exit lifecycle: `isVisible` drives the `.open` class and stays
  // true for the whole closing transform, so the drawer slides fully
  // off-screen before anything is hidden. `closingRef` guards double close.
  const [isVisible, setIsVisible] = useState(isOpen);
  const visibleRef = useRef(isVisible);
  const closingRef = useRef(false);
  const lockedRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    visibleRef.current = isVisible;
  }, [isVisible]);

  // Final step of the lifecycle: runs on the drawer's transform
  // `transitionend` (or synchronously under reduced motion). Restores scroll
  // and returns focus only AFTER the exit transform has completed.
  const finalizeClose = useCallback(() => {
    if (!closingRef.current) return;
    closingRef.current = false;
    if (lockedRef.current) {
      lockedRef.current = false;
      document.body.style.overflow = prevOverflowRef.current;
    }
    document.querySelector<HTMLElement>('.mobile-nav-toggle')?.focus({ preventScroll: true });
  }, []);

  const beginCloseVisual = useCallback(() => {
    if (closingRef.current || !visibleRef.current) return false;
    closingRef.current = true;
    setIsVisible(false);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // CSS disables transitions here, so no transitionend will ever fire.
      finalizeClose();
    }
    return true;
  }, [finalizeClose]);

  // Single closing entry point for X, backdrop, nav selection and CTAs.
  // Syncs the parent boolean; visuals follow `isVisible` until transitionend.
  const requestClose = useCallback(() => {
    beginCloseVisual();
    if (isOpenRef.current) onCloseRef.current();
  }, [beginCloseVisual]);

  const isInsideRequestFlow = isRequestFlowView(activeView);
  const isAdmin = isAuthenticated && Boolean(currentUser?.role?.includes('ADMIN'));
  const isMarketplace = activeView === 'marketplace';

  const handleMarketplaceRow = (action: () => void) => {
    if (window.location.pathname !== '/') {
      resetPathname();
    }
    setActiveView('marketplace');
    action();
    requestClose();
  };
  // Decorative engineering footer reuses the existing BBGG backdrop pair.
  const footerArtwork = resolvedTheme === 'dark' ? '/assets/BBGG01.png' : '/assets/BBGG02.png';

  const handleLinkClick = (view: ViewType, sectionId?: string) => {
    if (view === 'admin-dashboard' || (view === 'dashboard' && isAdmin)) {
      enterAdminPath();
      setActiveView('admin-dashboard');
      requestClose();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (window.location.pathname !== '/') {
      resetPathname();
    }
    setActiveView(view);
    requestClose();
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

  // Scroll lock: freeze the page while visible. The lock is released in
  // `finalizeClose` (after the exit transform), never at animation start, so
  // the page cannot shift mid-exit. The unmount path restores defensively.
  useEffect(() => {
    if (!isVisible) return undefined;
    lockedRef.current = true;
    prevOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      if (!closingRef.current && lockedRef.current) {
        lockedRef.current = false;
        document.body.style.overflow = prevOverflowRef.current;
      }
    };
  }, [isVisible]);

  // Focus into the drawer on open. Focus return happens in `finalizeClose`.
  useEffect(() => {
    if (!isVisible) return undefined;
    const frame = window.requestAnimationFrame(() => {
      closeRef.current?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isVisible]);

  // Parent-driven closes (Escape, programmatic navigation) converge on the
  // same visual lifecycle: keep the closing phase mounted until transitionend.
  useEffect(() => {
    if (isOpen) {
      closingRef.current = false;
      if (!visibleRef.current) setIsVisible(true);
    } else {
      beginCloseVisual();
    }
  }, [isOpen, beginCloseVisual]);

  // Close on programmatic route change and when leaving the mobile breakpoint.
  // Both simply request close; the exit animation runs before unmount visuals.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1201px)');
    const handleBreakpoint = () => {
      if (media.matches) onCloseRef.current();
    };
    media.addEventListener('change', handleBreakpoint);
    return () => media.removeEventListener('change', handleBreakpoint);
  }, []);

  const prevViewRef = useRef(activeView);
  useEffect(() => {
    if (prevViewRef.current !== activeView) {
      prevViewRef.current = activeView;
      onCloseRef.current();
    }
  }, [activeView]);

  // Lightweight focus containment while open (Escape is handled globally).
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab' || !drawerRef.current) return;
    const focusables = Array.from(
      drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // Drawer transform completion. Child transitions (opacity, colors) bubble
  // through here too, so only the drawer's own transform finalizes the close.
  const handleDrawerTransitionEnd = (event: React.TransitionEvent) => {
    if (event.target !== drawerRef.current || event.propertyName !== 'transform') return;
    finalizeClose();
  };

  const handleDrawerTransitionCancel = (event: TransitionEvent) => {
    if (event.target !== drawerRef.current || event.propertyName !== 'transform') return;
    finalizeClose();
  };

  // `transitioncancel` has no React 18 prop, so it is wired directly. A
  // cancelled exit (e.g. rapid reopen) must never finalize the close.
  useEffect(() => {
    const el = drawerRef.current;
    if (!el) return undefined;
    el.addEventListener('transitioncancel', handleDrawerTransitionCancel);
    return () => el.removeEventListener('transitioncancel', handleDrawerTransitionCancel);
  }, []);

  return (
    <div ref={rootRef} className={`mnav-root${isVisible ? ' open' : ''}`} aria-hidden={!isVisible}>
      <div
        className="mnav-backdrop"
        onClick={requestClose}
        aria-hidden="true"
      />
      <nav
        ref={drawerRef}
        id="mobile-nav-drawer"
        className="mobile-menu-drawer"
        aria-label={t('nav.main')}
        onKeyDown={handleKeyDown}
        onTransitionEnd={handleDrawerTransitionEnd}
      >
        <div className="mnav-head">
          <div className="mnav-brand">
            <Logo />
            <p className="mnav-tagline" aria-hidden="true">
              {t('market.annotBottom')}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="mnav-close"
            onClick={requestClose}
            aria-label={t('nav.closeMenu')}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <ul className="mnav-list">
          {NAV_ENTRIES.map((entry) => {
            const resolvedView =
              entry.view === 'dashboard' && isAdmin ? 'admin-dashboard' : entry.view;
            const label =
              entry.view === 'dashboard' && isAdmin ? t('nav.adminPanel') : t(entry.labelKey);
            const isActive =
              activeView === resolvedView ||
              (entry.view === 'dashboard' && isAdmin && activeView === 'admin-dashboard');
            return (
              <li key={entry.view}>
                <a
                  href={entry.view === 'dashboard' && isAdmin ? '/admin' : entry.href}
                  className={`mnav-row${isActive ? ' active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  tabIndex={isVisible ? 0 : -1}
                  onClick={(e) => {
                    e.preventDefault();
                    handleLinkClick(resolvedView, entry.sectionId);
                  }}
                >
                  <span className="mnav-icon" aria-hidden="true">
                    <Icon name={entry.icon} size={24} />
                  </span>
                  <span className="mnav-label">{label}</span>
                  <span className="mnav-chevron" aria-hidden="true">
                    <Icon name="chevronRight" size={22} />
                  </span>
                </a>
              </li>
            );
          })}
          {isMarketplace && (
            <>
              <li key="marketplace-favorites">
                <a
                  href="#marketplace-favorites"
                  className={`mnav-row${subView === 'favorites' ? ' active' : ''}`}
                  aria-current={subView === 'favorites' ? 'page' : undefined}
                  tabIndex={isVisible ? 0 : -1}
                  onClick={(e) => {
                    e.preventDefault();
                    handleMarketplaceRow(openFavorites);
                  }}
                >
                  <span className="mnav-icon" aria-hidden="true">
                    <Icon name="heart" size={24} />
                  </span>
                  <span className="mnav-label">
                    {t('nav.favorites')}
                    {favorites.size > 0 ? ` (${favorites.size})` : ''}
                  </span>
                  <span className="mnav-chevron" aria-hidden="true">
                    <Icon name="chevronRight" size={22} />
                  </span>
                </a>
              </li>
              <li key="marketplace-cart">
                <a
                  href="#marketplace-cart"
                  className={`mnav-row${subView === 'cart' ? ' active' : ''}`}
                  aria-current={subView === 'cart' ? 'page' : undefined}
                  tabIndex={isVisible ? 0 : -1}
                  onClick={(e) => {
                    e.preventDefault();
                    handleMarketplaceRow(openCart);
                  }}
                >
                  <span className="mnav-icon" aria-hidden="true">
                    <Icon name="cart" size={24} />
                  </span>
                  <span className="mnav-label">
                    {t('nav.cart')}
                    {itemCount > 0 ? ` (${itemCount})` : ''}
                  </span>
                  <span className="mnav-chevron" aria-hidden="true">
                    <Icon name="chevronRight" size={22} />
                  </span>
                </a>
              </li>
            </>
          )}
        </ul>

        <div className="mnav-actions">
          {!isInsideRequestFlow && (
            <button
              type="button"
              className="mnav-cta"
              tabIndex={isVisible ? 0 : -1}
              onClick={() => {
                requestClose();
                startManufacturingRequest();
              }}
            >
              <span className="mnav-cta-icon" aria-hidden="true">
                <Icon name="layers3" size={22} />
              </span>
              <span className="mnav-cta-label">{t('nav.startManufacturing')}</span>
              <span className="mnav-cta-arrow" aria-hidden="true">
                <Icon name="arrowRight" size={20} />
              </span>
            </button>
          )}
          <button
            type="button"
            className="mnav-account"
            tabIndex={isVisible ? 0 : -1}
            onClick={() => {
              requestClose();
              openAuthModal('login');
            }}
          >
            <span className="mnav-account-icon" aria-hidden="true">
              <Icon name="userRound" size={22} />
            </span>
            <span className="mnav-account-label">{t('nav.accountSignIn')}</span>
            <span className="mnav-chevron" aria-hidden="true">
              <Icon name="chevronRight" size={22} />
            </span>
          </button>
        </div>

        <div className="mnav-foot" aria-hidden="true">
          <img
            className="mnav-foot-art"
            src={footerArtwork}
            alt=""
            key={footerArtwork}
            draggable={false}
          />
          <p className="mnav-foot-text">{t('market.annotTop')}</p>
        </div>
      </nav>
    </div>
  );
};
