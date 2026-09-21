import React from 'react';
import { useStore } from '../../context/StoreContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { SectionReveal } from '../ui/Reveal';
import { Icon } from '../ui/Icon';

/**
 * Lightweight code-built CAD drawing for the front file card.
 * Decorative only (aria-hidden at the stack level): simple flange motif —
 * bore circle, bolt holes, dimension lines — in technical blue strokes.
 */
const CadDrawing: React.FC = () => (
  <svg viewBox="0 0 150 170" fill="none" stroke="currentColor" aria-hidden="true">
    <rect x="14" y="8" width="122" height="154" rx="6" opacity="0.35" />
    <circle cx="75" cy="70" r="30" strokeWidth="1.5" />
    <circle cx="75" cy="70" r="17" strokeWidth="1.2" opacity="0.8" />
    <circle cx="48" cy="48" r="5" opacity="0.8" />
    <circle cx="102" cy="48" r="5" opacity="0.8" />
    <circle cx="48" cy="92" r="5" opacity="0.8" />
    <circle cx="102" cy="92" r="5" opacity="0.8" />
    <line x1="75" y1="28" x2="75" y2="40" opacity="0.6" />
    <line x1="75" y1="100" x2="75" y2="112" opacity="0.6" />
    <line x1="33" y1="70" x2="45" y2="70" opacity="0.6" />
    <line x1="105" y1="70" x2="117" y2="70" opacity="0.6" />
    <line x1="30" y1="126" x2="120" y2="126" strokeDasharray="4 3" opacity="0.55" />
    <line x1="30" y1="140" x2="96" y2="140" opacity="0.4" />
    <circle cx="30" cy="140" r="2.5" opacity="0.7" />
    <path d="M52 152h46" strokeWidth="1.5" opacity="0.7" />
  </svg>
);

export const CtaBanner: React.FC = () => {
  const { startManufacturingRequest, openAuthModal } = useStore();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  // Exact theme mapping: BBGG01 (dark) / BBGG02 (light). Mirrored in RTL
  // via CSS on the background layer only.
  const backgroundImage = resolvedTheme === 'dark' ? '/assets/BBGG01.png' : '/assets/BBGG02.png';

  // Two-tone heading: leading words in icy white, remainder in technical
  // blue (stacked in LTR, inline flow in RTL via CSS).
  const titleWords = t('cta.title').split(' ').filter(Boolean);
  const titleLead = titleWords.slice(0, 3).join(' ') || t('cta.title');
  const titleRest = titleWords.slice(3).join(' ');

  const indicators: { icon: React.ReactNode; titleKey: string; descKey: string }[] = [
    {
      icon: <Icon name="shieldCheck" size={20} />,
      titleKey: 'cta.secureTitle',
      descKey: 'cta.secureDesc',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      titleKey: 'cta.instantTitle',
      descKey: 'cta.instantDesc',
    },
    {
      icon: <Icon name="cube" size={20} />,
      titleKey: 'cta.productionTitle',
      descKey: 'cta.productionDesc',
    },
  ];

  return (
    <SectionReveal className="section-padding mfg-cta" id="manufacturing-cta">
      <img
        className="mfg-cta-bg"
        src={backgroundImage}
        alt={t('cta.backgroundAlt')}
        key={backgroundImage}
        aria-hidden="true"
        draggable={false}
      />
      <div className="mfg-cta-veil" aria-hidden="true" />
      <span className="mfg-annotation mfg-annotation-left" aria-hidden="true">
        {t('cta.annotationLeft')}
      </span>

      <div className="container mfg-cta-container">
        <div className="cta-banner">
          {/* Code-built floating CAD file stack (decorative). */}
          <div className="mfg-cad" aria-hidden="true">
            <div className="mfg-cad-float">
              <span className="mfg-cad-orbit" />
              <span className="mfg-cad-file mfg-cad-file--back" />
              <span className="mfg-cad-file mfg-cad-file--mid" />
              <span className="mfg-cad-file mfg-cad-file--front">
                <CadDrawing />
                <span className="mfg-cad-step">.STEP</span>
              </span>
            </div>
            <div className="mfg-orb-float">
              <span className="mfg-orb">
                <Icon name="upload" size={26} />
              </span>
            </div>
          </div>

          <div className="cta-banner-content">
            <div className="section-badge">
              <span className="section-badge-dot"></span>
              <span>{t('cta.kicker')}</span>
            </div>
            <h2 className="section-title mfg-cta-title">
              <span className="mfg-cta-title-lead">{titleLead}</span>{' '}
              {titleRest ? <span className="mfg-cta-title-rest">{titleRest}</span> : null}
            </h2>
            <p className="mfg-cta-desc">
              {t('cta.description')}
            </p>
            <div className="mfg-cta-actions">
              <button className="btn btn-lg btn-primary cam-shine-auto mfg-btn" onClick={() => startManufacturingRequest()} id="cta-banner-start-manufacturing">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                {t('cta.startManufacturing')}
                <span className="mfg-btn-arrow" aria-hidden="true">
                  <Icon name="arrowRight" size={17} />
                </span>
              </button>
              <button className="btn btn-lg btn-outline mfg-btn mfg-btn-secondary" onClick={() => openAuthModal('login')} id="cta-banner-sign-in">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="5" y1="20" x2="5" y2="12" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="19" y1="20" x2="19" y2="9" />
                </svg>
                {t('cta.accessDashboard')}
                <span className="mfg-btn-arrow" aria-hidden="true">
                  <Icon name="arrowRight" size={17} />
                </span>
              </button>
            </div>
            <div className="mfg-indicators">
              {indicators.map((item) => (
                <div className="mfg-indicator" key={item.titleKey}>
                  <span className="mfg-indicator-icon">{item.icon}</span>
                  <span className="mfg-indicator-text">
                    <strong>{t(item.titleKey)}</strong>
                    <span>{t(item.descKey)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="mfg-microcopy" aria-hidden="true">
            <span className="mfg-microcopy-rule" />
            {t('cta.annotationRight')}
          </p>
        </div>
      </div>
    </SectionReveal>
  );
};
