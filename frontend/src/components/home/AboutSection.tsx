import React from 'react';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';
import { SectionReveal, StaggerReveal } from '../ui/Reveal';

export const AboutSection: React.FC = () => {
  const { startManufacturingRequest } = useStore();
  const { t } = useTranslation();

  const valueProps = [
    {
      title: t('about.dfmTitle'), subtitle: t('about.dfmSubtitle'), desc: t('about.dfmDescription'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      title: t('about.ipTitle'), subtitle: t('about.ipSubtitle'), desc: t('about.ipDescription'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      title: t('about.nodesTitle'), subtitle: t('about.nodesSubtitle'), desc: t('about.nodesDescription'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
    {
      title: t('about.cmmTitle'), subtitle: t('about.cmmSubtitle'), desc: t('about.cmmDescription'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M3 12h3M18 12h3M12 3v3M12 18v3" />
        </svg>
      ),
    },
    {
      title: t('about.rapidTitle'), subtitle: t('about.rapidSubtitle'), desc: t('about.rapidDescription'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 14 14" />
        </svg>
      ),
    },
    {
      title: t('about.supportTitle'), subtitle: t('about.supportSubtitle'), desc: t('about.supportDescription'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
  ];

  return (
    <SectionReveal
      className="section-padding themed-section-band"
      id="about"
    >
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <div className="section-badge">
            <span className="section-badge-dot"></span>
            <span>{t('about.kicker')}</span>
          </div>
          <h2 className="section-title">{t('about.title')}</h2>
          <p className="section-subtitle">
            {t('about.description')}
          </p>
        </div>

        {/* Value Proposition Grid */}
        <StaggerReveal
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'var(--space-6)',
            marginBottom: 'var(--space-10)',
          }}
        >
          {valueProps.map((vp) => (
            <div key={vp.title} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(0, 102, 255, 0.1)',
                    border: '1px solid var(--cam-border-blue)',
                    color: 'var(--cam-blue-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {vp.icon}
                </div>
                <div>
                  <h3 className="card-title" style={{ fontSize: '1.0625rem', marginBottom: '2px' }}>
                    {vp.title}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--cam-cyan-tech)', fontFamily: 'var(--font-mono)' }}>
                    {vp.subtitle}
                  </div>
                </div>
              </div>
              <p className="card-description" style={{ fontSize: '0.875rem', lineHeight: '1.6', marginTop: 'var(--space-2)' }}>
                {vp.desc}
              </p>
            </div>
          ))}
        </StaggerReveal>

        {/* Company Mission Banner */}
        <div
          style={{
            background: 'var(--cam-surface-2)',
            border: '1px solid var(--cam-border-medium)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-8)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-6)',
          }}
        >
          <div style={{ maxWidth: '720px' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--cam-blue-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600, marginBottom: '6px' }}>
              {t('about.missionLabel')}
            </div>
            <h3 style={{ fontSize: '1.375rem', marginBottom: '8px' }}>
              {t('about.missionTitle')}
            </h3>
            <p style={{ color: 'var(--cam-text-muted)', fontSize: '0.9375rem', lineHeight: '1.6' }}>
              {t('about.missionDescription')}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => startManufacturingRequest()}>
            {t('about.startRequest')}
          </button>
        </div>
      </div>
    </SectionReveal>
  );
};
