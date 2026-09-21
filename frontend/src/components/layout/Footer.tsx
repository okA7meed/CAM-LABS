import React, { useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import type { ViewType } from '../../types';
import { Logo } from './Logo';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { useTranslation } from 'react-i18next';
import { FooterReveal } from '../ui/Reveal';
import { FOOTER_COLUMNS, FOOTER_LEGAL, FOOTER_SOCIAL, type FooterRow, type FooterTarget } from './footerNav';
import { enterAdminPath, resetPathname } from '../../routing/hashRouter';

/**
 * CAM LABS Mega Footer — brand + Manufacturing + Platform + Company & Support.
 * Every row resolves through footerNav.ts to real application content:
 * no placeholder hrefs, no fake destinations, auth-aware customer links.
 */
export const Footer: React.FC = () => {
  const {
    setActiveView,
    startManufacturingRequest,
    requestMaterialsPreset,
    openAuthModal,
    setPostAuthDestination,
  } = useStore();
  const { isAuthenticated, currentUser } = useAuth();
  const { t } = useTranslation();
  const isAdmin = isAuthenticated && Boolean(currentUser?.role?.includes('ADMIN'));

  const scrollToSection = useCallback((sectionId: string) => {
    window.setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (!el) return;
      const headerH = document.querySelector('.cam-header')?.getBoundingClientRect().height ?? 72;
      const targetTop = el.getBoundingClientRect().top + window.scrollY - headerH - 16;
      window.scrollTo({ top: targetTop, behavior: 'smooth' });
    }, 60);
  }, []);

  const goView = useCallback((view: ViewType, sectionId?: string) => {
    resetPathname();
    setActiveView(view);
    if (sectionId) scrollToSection(sectionId);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setActiveView, scrollToSection]);

  const activate = useCallback((target: FooterTarget) => {
    switch (target.kind) {
      case 'view':
        goView(target.view, target.sectionId);
        return;
      case 'materials':
        requestMaterialsPreset(target.preset);
        goView('materials', 'materials-section');
        return;
      case 'submitQuote':
        // Existing manufacturing request flow: creates a Quote ONLY,
        // preserves the auth gate and server-persisted draft.
        startManufacturingRequest();
        return;
      case 'customer': {
        if (!isAuthenticated) {
          // Real auth flow with resume: login returns here, not dashboard.
          setPostAuthDestination(target.view);
          openAuthModal('login');
          return;
        }
        if (target.view === 'dashboard' && isAdmin) {
          enterAdminPath();
          setActiveView('admin-dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        goView(target.view);
        return;
      }
    }
  }, [goView, requestMaterialsPreset, startManufacturingRequest, isAuthenticated, isAdmin, setActiveView, setPostAuthDestination, openAuthModal]);

  const goHome = useCallback(() => goView('home'), [goView]);

  const renderRow = (row: FooterRow) => (
    <li key={row.labelKey} className="mf-row-wrap">
      <button type="button" className="mf-row" onClick={() => activate(row.target)}>
        <span className="mf-row-icon" aria-hidden="true">
          <Icon name={row.icon} size={19} />
        </span>
        <span className="mf-row-label">{t(row.labelKey)}</span>
        <Icon name="chevronRight" size={15} className="mf-row-chevron" />
      </button>
    </li>
  );

  return (
    <FooterReveal className="cam-footer mf-footer">
      <div className="container mf-container">
        <div className="mf-grid">
          {/* Brand column — stacked lockup: the real CAM mark is a wide
              asset, so the wordmark sits beneath it instead of colliding. */}
          <div className="mf-brand">
            <button type="button" className="mf-brand-lockup" onClick={goHome} aria-label="CAM LABS — home">
              <Logo className="mf-logo" alt="CAM LABS" />
              <span className="mf-wordmark" aria-hidden="true">
                <span className="mf-wordmark-main">
                  CAM <em>LABS</em>
                </span>
                <span className="mf-wordmark-sub">{t('footer2.brandTag')}</span>
              </span>
            </button>
            <p className="mf-brand-copy">{t('footer2.brandCopy')}</p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <React.Fragment key={col.headingKey}>
              <span className="mf-divider" aria-hidden="true" />
              <nav className="mf-col" aria-label={t(col.headingKey)}>
                <div className="mf-col-head">
                  <span className="mf-col-icon" aria-hidden="true">
                    <Icon name={col.headingIcon as IconName} size={26} />
                  </span>
                  <span className="mf-col-titles">
                    <span className="mf-col-heading">{t(col.headingKey)}</span>
                    <span className="mf-col-sub">{t(col.subtitleKey)}</span>
                  </span>
                </div>
                <ul className="mf-rows">{col.rows.map(renderRow)}</ul>
              </nav>
            </React.Fragment>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mf-bottom">
          <p className="mf-copy">{t('footer.rights')}</p>
          <div className="mf-social" role="group" aria-label="Social">
            {FOOTER_SOCIAL.map((s) => (
              <span
                key={s.key}
                className="mf-social-btn is-disabled"
                title={t('footer2.socialPending')}
                aria-label={`${t(s.labelKey)} — ${t('footer2.socialPending')}`}
                aria-disabled="true"
              >
                <Icon name={s.icon} size={19} />
              </span>
            ))}
          </div>
          <nav className="mf-legal" aria-label="Legal">
            {FOOTER_LEGAL.map((entry) => (
              <button key={entry.view} type="button" onClick={() => goView(entry.view)}>
                {t(entry.labelKey)}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </FooterReveal>
  );
};
