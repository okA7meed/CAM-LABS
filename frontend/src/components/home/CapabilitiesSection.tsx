import React from 'react';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';
import { SectionReveal, StaggerReveal } from '../ui/Reveal';

export const CapabilitiesSection: React.FC = () => {
  const { showToast } = useStore();
  const { t } = useTranslation();

  const handleDownloadReport = () => {
    showToast(t('capabilities.downloaded'), t('capabilities.downloadedDescription'), 'success');
  };

  return (
    <SectionReveal className="section-padding" id="capabilities-section">
      <div className="container">
        <StaggerReveal className="capabilities-grid">
          <div>
            <div className="section-badge">
              <span className="section-badge-dot"></span>
              <span>{t('capabilities.kicker')}</span>
            </div>
            <h2 className="section-title">{t('capabilities.title')}</h2>
            <p className="section-subtitle" style={{ marginBottom: 'var(--space-6)' }}>
              {t('capabilities.description')}
            </p>

            <div className="capability-feature-list">
              <div className="capability-feature-item">
                <div className="feature-icon-box">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <strong style={{ color: 'var(--cam-text-primary)', fontSize: '0.9375rem' }}>
                    {t('capabilities.certifiedNodes')}
                  </strong>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--cam-text-muted)', marginTop: '2px' }}>
                    {t('capabilities.certifiedNodesDescription')}
                  </p>
                </div>
              </div>

              <div className="capability-feature-item">
                <div className="feature-icon-box">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <strong style={{ color: 'var(--cam-text-primary)', fontSize: '0.9375rem' }}>
                    {t('capabilities.tolerances')}
                  </strong>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--cam-text-muted)', marginTop: '2px' }}>
                    {t('capabilities.tolerancesDescription')}
                  </p>
                </div>
              </div>

              <div className="capability-feature-item">
                <div className="feature-icon-box">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div>
                  <strong style={{ color: 'var(--cam-text-primary)', fontSize: '0.9375rem' }}>
                    {t('capabilities.reports')}
                  </strong>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--cam-text-muted)', marginTop: '2px' }}>
                    {t('capabilities.reportsDescription')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Inspection Report Mock UI */}
          <div className="inspection-report-mock">
            <div className="report-header">
              <div>
                <strong style={{ color: 'var(--cam-text-primary)', fontSize: '0.875rem' }}>{t('capabilities.auditTitle')}</strong>
                <div style={{ color: 'var(--cam-text-muted)', fontSize: '0.75rem' }}>{t('capabilities.part')}</div>
              </div>
              <span className="badge badge-success">{t('capabilities.passed')}</span>
            </div>

            <div className="report-row">
              <span>{t('capabilities.dimA')}</span>
              <strong style={{ color: 'var(--cam-text-primary)' }}>25.008 mm (Dev: +0.008 mm)</strong>
            </div>
            <div className="report-row">
              <span>{t('capabilities.dimB')}</span>
              <strong style={{ color: 'var(--cam-text-primary)' }}>12.012 mm (Dev: +0.012 mm)</strong>
            </div>
            <div className="report-row">
              <span>{t('capabilities.roughness')}</span>
              <strong style={{ color: 'var(--cam-text-primary)' }}>1.42 μm (Spec &lt; 1.6 μm)</strong>
            </div>
            <div className="report-row">
              <span>{t('capabilities.position')}</span>
              <strong style={{ color: 'var(--cam-text-primary)' }}>0.018 mm (Tol: 0.05 mm)</strong>
            </div>
            <div className="report-row">
              <span>{t('capabilities.batch')}</span>
              <strong style={{ color: 'var(--cam-text-primary)' }}>AL-6061-T6 (Certified)</strong>
            </div>

            <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--cam-text-muted)' }}>{t('capabilities.inspector')}</span>
              <button className="btn btn-sm btn-outline" onClick={handleDownloadReport}>
                {t('capabilities.viewCertificate')}
              </button>
            </div>
          </div>
        </StaggerReveal>
      </div>
    </SectionReveal>
  );
};
