import React from 'react';
import { useStore } from '../../context/StoreContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { SectionReveal, StaggerReveal } from '../ui/Reveal';
import { Icon } from '../ui/Icon';

/** Presentation-only: drop the trailing colon from table row labels. */
const stripTrailingColon = (label: string): string => label.replace(/[:：]\s*$/, '');

export const CapabilitiesSection: React.FC = () => {
  const { showToast } = useStore();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  // Theme-owned background artwork (same pattern as the hero section):
  // BGG1 (dark) / BGG2 (light). Both share one aspect ratio (1953×805).
  const backgroundImage = resolvedTheme === 'dark' ? '/assets/BGG1.png' : '/assets/BGG2.png';

  const handleDownloadReport = () => {
    showToast(t('capabilities.downloaded'), t('capabilities.downloadedDescription'), 'success');
  };

  // Two-tone heading: leading word in icy white, remainder in technical blue.
  // Word-based (not character-based) so Arabic RTL keeps natural word order.
  const titleWords = t('capabilities.title').split(' ').filter(Boolean);
  const titleLead = titleWords[0] ?? t('capabilities.title');
  const titleRest = titleWords.slice(1).join(' ');

  const auditRows: { label: string; value: string; spec: string }[] = [
    { label: stripTrailingColon(t('capabilities.dimA')), value: '25.008 mm', spec: '(Dev: +0.008 mm)' },
    { label: stripTrailingColon(t('capabilities.dimB')), value: '12.012 mm', spec: '(Dev: +0.012 mm)' },
    { label: stripTrailingColon(t('capabilities.roughness')), value: '1.42 μm', spec: '(Spec < 1.6 μm)' },
    { label: stripTrailingColon(t('capabilities.position')), value: '0.018 mm', spec: '(Tol: 0.05 mm)' },
    { label: stripTrailingColon(t('capabilities.batch')), value: 'AL-6061-T6', spec: '(Certified)' },
  ];

  const featureCards: { icon: 'shieldCheck' | 'target' | 'file'; titleKey: string; descKey: string }[] = [
    { icon: 'shieldCheck', titleKey: 'capabilities.certifiedNodes', descKey: 'capabilities.certifiedNodesDescription' },
    { icon: 'target', titleKey: 'capabilities.tolerances', descKey: 'capabilities.tolerancesDescription' },
    { icon: 'file', titleKey: 'capabilities.reports', descKey: 'capabilities.reportsDescription' },
  ];

  return (
    <SectionReveal className="section-padding capabilities-section" id="capabilities-section">
      <img
        className="capabilities-bg"
        src={backgroundImage}
        alt={t('capabilities.backgroundAlt')}
        key={backgroundImage}
        aria-hidden="true"
        draggable={false}
      />
      <div className="capabilities-overlay" aria-hidden="true" />

      <div className="container capabilities-container">
        <StaggerReveal className="capabilities-grid">
          <div className="capabilities-intro">
            <div className="section-badge">
              <span className="section-badge-dot"></span>
              <span>{t('capabilities.kicker')}</span>
            </div>
            <h2 className="section-title capabilities-title">
              <span className="cap-title-lead">{titleLead}</span>{' '}
              {titleRest ? <span className="cap-title-rest">{titleRest}</span> : null}
            </h2>
            <p className="section-subtitle capabilities-subtitle">
              {t('capabilities.description')}
            </p>

            <div className="capability-feature-list">
              {featureCards.map((card) => (
                <div className="capability-feature-item" key={card.titleKey}>
                  <span className="feature-icon-box">
                    <Icon name={card.icon} size={22} />
                  </span>
                  <span className="capability-feature-text">
                    <strong>{t(card.titleKey)}</strong>
                    <p>{t(card.descKey)}</p>
                  </span>
                  <Icon name="chevronRight" size={20} className="capability-feature-chevron" />
                </div>
              ))}
            </div>

            <p className="capabilities-microcopy">
              <span className="capabilities-microcopy-rule" aria-hidden="true" />
              {t('capabilities.microcopy')}
            </p>
          </div>

          {/* CMM dimensional audit dashboard */}
          <div className="inspection-report-mock">
            <div className="report-header audit-header">
              <span className="audit-header-icon">
                <Icon name="cube" size={22} />
              </span>
              <span className="audit-header-text">
                <strong>{t('capabilities.auditTitle')}</strong>
                <span className="audit-part">{t('capabilities.part')}</span>
              </span>
              <span className="badge badge-success audit-passed">
                <Icon name="check" size={14} />
                {t('capabilities.passed')}
              </span>
            </div>

            <table className="audit-table">
              <thead>
                <tr>
                  <th scope="col">{t('capabilities.tableParameter')}</th>
                  <th scope="col">{t('capabilities.tableMeasured')}</th>
                  <th scope="col">{t('capabilities.tableTolerance')}</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((row) => (
                  <tr key={row.label}>
                    <td className="audit-param">{row.label}</td>
                    <td className="audit-value">{row.value}</td>
                    <td className="audit-spec">{row.spec}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="audit-footer">
              <span className="audit-inspector">{t('capabilities.inspector')}</span>
              <button type="button" className="btn btn-sm btn-outline audit-cert-btn" onClick={handleDownloadReport}>
                <Icon name="file" size={15} />
                {t('capabilities.viewCertificate')}
                <Icon name="chevronRight" size={15} className="audit-cert-arrow" />
              </button>
            </div>
          </div>
        </StaggerReveal>
      </div>
    </SectionReveal>
  );
};
