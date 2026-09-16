import React, { useMemo } from 'react';
import { AnimatedHeadline } from './AnimatedHeadline';
import { useStore } from '../../context/StoreContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Icon } from '../ui/Icon';

export const HeroSection: React.FC = () => {
  const { setActiveView, startManufacturingRequest } = useStore();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const heroImage = resolvedTheme === 'dark' ? '/assets/heross001.PNG' : '/assets/heross02.PNG';
  const headlinePhrases = useMemo(
    () => [
      t('hero.industrialProduction'),
      t('hero.digitalTech'),
      t('hero.digitalManufacturing'),
      t('hero.precisionProduction'),
      t('hero.smartManufacturing'),
    ],
    [t],
  );

  return (
    <section className="hero-section" id="hero-section">
      <div className="hero-visual">
        <img
          className="hero-img"
          src={heroImage}
          alt={t('hero.backgroundAlt')}
          key={heroImage}
        />
        <div className="hero-overlay" aria-hidden="true" />

        <div className="container">
          <div className="hero-grid">
            {/* Hero Marketing Copy */}
            <div className="hero-content">
              <h1 className="hero-title cam-hero-in" style={{ '--cam-hero-delay': '160ms' } as React.CSSProperties}>
                <span className="hero-title-prefix">{t('hero.digitalCad')}</span>
                <span className="hero-title-action">
                  <AnimatedHeadline className="hero-title-highlight" phrases={headlinePhrases} />
                </span>
              </h1>

              <p className="hero-description cam-hero-in" style={{ '--cam-hero-delay': '300ms' } as React.CSSProperties}>
                {t('hero.description')}
              </p>

              <div className="hero-cta-group cam-hero-in" style={{ '--cam-hero-delay': '400ms' } as React.CSSProperties}>
                <button
                  className="btn btn-lg btn-primary cam-shine-auto"
                  onClick={() => startManufacturingRequest()}
                  id="hero-cta-start-manufacturing"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                  {t('nav.startManufacturing')}
                </button>
                <a
                  href="#services"
                  className="btn btn-lg btn-outline"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveView('services');
                    setTimeout(() => {
                      const el = document.getElementById('services-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }, 50);
                  }}
                  id="hero-cta-explore-services"
                >
                  {t('actions.exploreServices')}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Manufacturing Trust Strip — full-width feature strip */}
        <div className="hero-benefits cam-hero-in" style={{ '--cam-hero-delay': '520ms' } as React.CSSProperties}>
          <div className="hero-benefit-item">
            <span className="hero-benefit-icon"><Icon name="precision" size={22} /></span>
            <span className="hero-benefit-body">
              <span className="hero-benefit-val">{t('hero.precisionValue')}</span>
              <span className="hero-benefit-label">{t('hero.precision')}</span>
            </span>
          </div>
          <div className="hero-benefit-item">
            <span className="hero-benefit-icon"><Icon name="clock" size={22} /></span>
            <span className="hero-benefit-body">
              <span className="hero-benefit-val">{t('hero.fastTurnaroundValue')}</span>
              <span className="hero-benefit-label">{t('hero.fastTurnaround')}</span>
            </span>
          </div>
          <div className="hero-benefit-item">
            <span className="hero-benefit-icon"><Icon name="shieldCheck" size={22} /></span>
            <span className="hero-benefit-body">
              <span className="hero-benefit-val">{t('hero.secure')}</span>
              <span className="hero-benefit-label">{t('hero.cadProtection')}</span>
            </span>
          </div>
          <div className="hero-benefit-item">
            <span className="hero-benefit-icon"><Icon name="mapPin" size={22} /></span>
            <span className="hero-benefit-body">
              <span className="hero-benefit-val">{t('hero.egypt')}</span>
              <span className="hero-benefit-label">{t('hero.localProduction')}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};