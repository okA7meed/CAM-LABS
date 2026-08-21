import React from 'react';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';
import { SectionReveal } from '../ui/Reveal';

export const CtaBanner: React.FC = () => {
  const { setActiveView, openAuthModal } = useStore();
  const { t } = useTranslation();

  return (
    <SectionReveal className="section-padding">
      <div className="container">
        <div className="cta-banner">
          <div className="cta-banner-content">
            <div className="section-badge">
              <span className="section-badge-dot"></span>
              <span>{t('cta.kicker')}</span>
            </div>
            <h2 style={{ fontSize: 'clamp(1.875rem, 4vw, 2.75rem)', marginBottom: 'var(--space-4)' }}>
              {t('cta.title')}
            </h2>
            <p style={{ color: 'var(--cam-text-secondary)', fontSize: '1.125rem', marginBottom: 'var(--space-8)' }}>
              {t('cta.description')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <button className="btn btn-lg btn-primary cam-shine-auto" onClick={() => setActiveView('manufacturing-request')} id="cta-banner-start-manufacturing">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                {t('cta.startManufacturing')}
              </button>
              <button className="btn btn-lg btn-outline" onClick={() => openAuthModal('login')} id="cta-banner-sign-in">
                {t('cta.accessDashboard')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </SectionReveal>
  );
};
