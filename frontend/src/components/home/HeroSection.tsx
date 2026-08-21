import React, { useCallback, useMemo, useRef } from 'react';
import { CadViewerStage } from './CadViewerStage';
import { AnimatedHeadline } from './AnimatedHeadline';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';

/** Maximum pointer-driven offset of the CAD stage, in pixels. */
const STAGE_TILT_RANGE = 6;

export const HeroSection: React.FC = () => {
  const { setActiveView } = useStore();
  const { t } = useTranslation();
  const stageShellRef = useRef<HTMLDivElement | null>(null);

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

  // Writes CSS variables directly so pointer movement never triggers a re-render.
  const handleStagePointerMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const shell = stageShellRef.current;
    if (!shell) return;
    const bounds = shell.getBoundingClientRect();
    const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;
    shell.style.setProperty('--cam-tilt-x', `${(offsetX * STAGE_TILT_RANGE).toFixed(2)}px`);
    shell.style.setProperty('--cam-tilt-y', `${(offsetY * STAGE_TILT_RANGE).toFixed(2)}px`);
  }, []);

  const handleStagePointerLeave = useCallback(() => {
    const shell = stageShellRef.current;
    if (!shell) return;
    shell.style.setProperty('--cam-tilt-x', '0px');
    shell.style.setProperty('--cam-tilt-y', '0px');
  }, []);

  return (
    <section className="hero-section" id="hero-section">
      <div className="container">
        <div className="hero-grid">
          {/* Hero Marketing Copy */}
          <div className="hero-content">
            <div className="hero-badge-row cam-hero-in" style={{ '--cam-hero-delay': '60ms' } as React.CSSProperties}>
              <div className="section-badge">
                <span className="section-badge-dot"></span>
                <span>{t('hero.standards')}</span>
              </div>
              <span className="badge badge-blue">{t('hero.tolerance')}</span>
            </div>

            <h1 className="hero-title cam-hero-in" style={{ '--cam-hero-delay': '160ms' } as React.CSSProperties}>
              <span className="hero-title-prefix">{t('hero.digitalCad')}</span>{' '}
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
                onClick={() => setActiveView('manufacturing-request')}
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

            {/* Platform Metrics Ticker */}
            <div className="hero-metrics-ticker cam-hero-in" style={{ '--cam-hero-delay': '520ms' } as React.CSSProperties}>
              <div className="hero-metric-item">
                <span className="hero-metric-val">± 0.025 mm</span>
                <span className="hero-metric-label">{t('hero.cncMachining')}</span>
              </div>
              <div className="hero-metric-item">
                <span className="hero-metric-val">50+</span>
                <span className="hero-metric-label">{t('hero.engineeringPolymers')}</span>
              </div>
              <div className="hero-metric-item">
                <span className="hero-metric-val">24 - 48h</span>
                <span className="hero-metric-label">{t('hero.rapidDispatch')}</span>
              </div>
              <div className="hero-metric-item">
                <span className="hero-metric-val">99.94%</span>
                <span className="hero-metric-label">{t('hero.firstPassQa')}</span>
              </div>
            </div>
          </div>

          {/* Hero 3D CAD Showcase Stage */}
          <div
            ref={stageShellRef}
            className="hero-stage-shell cam-hero-in"
            style={{ '--cam-hero-delay': '360ms' } as React.CSSProperties}
            onMouseMove={handleStagePointerMove}
            onMouseLeave={handleStagePointerLeave}
          >
            <CadViewerStage />
          </div>
        </div>
      </div>
    </section>
  );
};
