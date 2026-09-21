import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { ViewType } from '../../types';
import { Logo } from './Logo';
import { HeaderPreferences } from './HeaderPreferences';
import { UserAvatar, getUserAvatarColor } from '../ui/UserAvatar';
import { Icon } from '../ui/Icon';
import { useTranslation } from 'react-i18next';
import { isRequestFlowView } from '../../constants/navigation';
import { enterAdminPath, resetPathname } from '../../routing/hashRouter';

interface HeaderProps {
  onToggleMobileNav: () => void;
  mobileNavOpen: boolean;
}

// Sections tracked on the landing page for scroll-aware nav highlighting
const SCROLL_SECTIONS: Array<{ id: string; view: ViewType }> = [
  { id: 'hero-section', view: 'home' },
  { id: 'services-section', view: 'services' },
  { id: 'workflow-section', view: 'workflow' },
  { id: 'materials-section', view: 'materials' },
  { id: 'about', view: 'about' },
];

const NON_LANDING_VIEWS: ViewType[] = ['dashboard', 'orders', 'profile', 'marketplace', 'manufacturing-request', 'coming-soon', 'equation-builder'];

export const Header: React.FC<HeaderProps> = ({ onToggleMobileNav, mobileNavOpen }) => {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { activeView, setActiveView, startManufacturingRequest, openAuthModal } = useStore();
  const {
    subView,
    goToListing,
    openFavorites,
    openCart,
    favorites,
    itemCount,
    searchQuery,
    setSearchQuery,
  } = useMarketplace();
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  // Marketplace navigation mode: same Navbar shell, marketplace content.
  // Active while the user is inside listing, product, favorites, cart, or
  // marketplace search — restored to normal content on exit.
  const isMarketplace = activeView === 'marketplace';

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

  const isAdmin = isAuthenticated && Boolean(currentUser?.role?.includes('ADMIN'));

  const handleMarketplaceSearch = (query: string) => {
    // Searching always targets the listing; move there if the user is in a
    // product, cart, or favorites sub-view.
    if (subView !== 'listing') goToListing();
    setSearchQuery(query);
  };

  const handleNavClick = (view: ViewType, sectionId?: string) => {
    if (view === 'admin-dashboard' || (view === 'dashboard' && isAdmin)) {
      // Real `/admin` pathname is server-routed; preserve the view hash.
      if (window.location.pathname !== '/admin') {
        enterAdminPath();
      }
      setActiveView('admin-dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (window.location.pathname !== '/') {
      resetPathname();
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
    {
      label: isAdmin ? t('nav.adminPanel') : t('nav.dashboard'),
      view: isAdmin ? 'admin-dashboard' : 'dashboard',
    },
  ];

  // Marketplace mode keeps the identical shell (brand, actions, CTA, prefs)
  // and only swaps the navigation content: Marketplace root, Manufacturing
  // destination, Favorites, Cart, and product search.
  const marketplaceNavItems: Array<{ label: string; view: ViewType; sectionId?: string; onSelect?: () => void }> = [
    { label: t('nav.marketplace'), view: 'marketplace', onSelect: goToListing },
    { label: t('nav.manufacturing'), view: 'materials', sectionId: 'materials-section' },
  ];

  return (
    <header className={`cam-header ${scrolled ? 'scrolled' : ''}${isInsideRequestFlow ? ' cam-header--compact' : ''}`}>
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
          {isMarketplace
            ? marketplaceNavItems.map(({ label, view, sectionId, onSelect }) => (
              <a
                key={view}
                href={`#${sectionId || view}`}
                className="nav-link"
                aria-current={activeView === view ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  if (onSelect) {
                    resetPathname();
                    setActiveView('marketplace');
                    onSelect();
                  } else {
                    handleNavClick(view, sectionId);
                  }
                }}
              >
                {label}
              </a>
            ))
            : navigationItems.map(({ label, view, sectionId }) => (
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
          {isMarketplace && (
            <>
              <div className="mk-nav-search" role="search">
                <Icon name="search" size={16} className="mk-nav-search-icon" />
                <label className="mk-search-label" htmlFor="mk-nav-search-input">{t('market.searchLabel')}</label>
                <input
                  id="mk-nav-search-input"
                  className="mk-nav-search-input"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => handleMarketplaceSearch(event.target.value)}
                  placeholder={t('market.searchPlaceholder')}
                  aria-label={t('market.searchLabel')}
                />
              </div>
              <button
                type="button"
                className={`nav-icon-button mk-nav-btn${subView === 'favorites' ? ' active' : ''}`}
                onClick={openFavorites}
                aria-label={favorites.size > 0 ? `${t('market.favorites')} (${favorites.size})` : t('market.favorites')}
                title={t('market.favorites')}
              >
                <Icon name="heart" size={18} />
                {favorites.size > 0 && (
                  <span className="mk-count-badge" aria-hidden="true">{favorites.size}</span>
                )}
              </button>
              <button
                type="button"
                className={`nav-icon-button mk-nav-btn${subView === 'cart' ? ' active' : ''}`}
                onClick={openCart}
                aria-label={itemCount > 0 ? `${t('market.cart')} (${itemCount})` : t('market.cart')}
                title={t('market.cart')}
              >
                <Icon name="cart" size={18} />
                {itemCount > 0 && (
                  <span className="mk-count-badge" aria-hidden="true">{itemCount}</span>
                )}
              </button>
            </>
          )}
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
              <button
                className="header-sign-in"
                onClick={() => handleNavClick(isAdmin ? 'admin-dashboard' : 'dashboard')}
              >
                {isAdmin ? t('nav.adminPanel') : t('nav.dashboard')}
              </button>
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
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav-drawer"
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
