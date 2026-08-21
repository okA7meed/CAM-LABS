import React from 'react';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';
import { SectionReveal, StaggerReveal } from '../ui/Reveal';

interface ServiceDefinition {
  id: string;
  translationId: 'industrial3d' | 'fdm' | 'cnc' | 'sheet' | 'tooling';
  title: string;
  category: string;
  description: string;
  materialRef?: string;
  techTags: string[];
  specs: {
    tolerance: string;
    leadTime: string;
    keyMetricLabel: string;
    keyMetricValue: string;
    standard: string;
  };
  iconSvg: React.ReactNode;
}

const SERVICES_CATALOG: ServiceDefinition[] = [
  {
    id: '3d-printing-industrial',
    translationId: 'industrial3d',
    title: 'Industrial 3D Printing',
    category: 'Additive Manufacturing',
    description: 'High-density laser sintering (SLS) and high-resolution stereolithography (SLA) for production-grade polymers and isotropic mechanical strength.',
    materialRef: 'pa12-sls',
    techTags: ['SLS Nylon 12', 'SLA Tough 100', 'DMLS Metal', 'No Tooling'],
    specs: {
      tolerance: '± 0.08 mm',
      leadTime: 'From 24 Hours',
      keyMetricLabel: 'Min Wall Thickness',
      keyMetricValue: '0.6 mm',
      standard: 'ISO/ASTM 52900',
    },
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    id: 'fdm-high-performance',
    translationId: 'fdm',
    title: 'High-Performance FDM',
    category: 'Industrial Thermoplastics',
    description: 'Industrial extrusion of aerospace-grade thermoplastics including PEEK, ULTEM™ 9085, and carbon-fiber composites for extreme operating environments.',
    materialRef: 'peek-fdm',
    techTags: ['PEEK 450G', 'ULTEM™ 9085', 'FAR 25.853 Flammability', 'Continuous Fiber'],
    specs: {
      tolerance: '± 0.15 mm',
      leadTime: '2 - 3 Days',
      keyMetricLabel: 'Max Operating Temp',
      keyMetricValue: '250 °C',
      standard: 'ASTM D638 / D648',
    },
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    id: 'cnc-machining-precision',
    translationId: 'cnc',
    title: 'Precision CNC Machining',
    category: 'Subtractive Manufacturing',
    description: '3-axis, 4-axis, and 5-axis CNC milling along with live-tooling turning for aerospace alloys, stainless steels, and engineered polymers.',
    materialRef: 'alu-6061-cnc',
    techTags: ['5-Axis Milling', 'CNC Turning', 'Al 6061/7075', 'SS 316L'],
    specs: {
      tolerance: '± 0.025 mm',
      leadTime: '3 - 5 Days',
      keyMetricLabel: 'Surface Roughness',
      keyMetricValue: 'Ra 0.8 - 1.6 μm',
      standard: 'DIN ISO 2768-f',
    },
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    id: 'sheet-metal-laser',
    translationId: 'sheet',
    title: 'Sheet Metal & Laser Cutting',
    category: 'Forming & Fabrication',
    description: 'Precision fiber laser cutting, CNC press brake forming, hardware insertion (PEM studs/standoffs), and robotic TIG/MIG welding.',
    materialRef: 'sheet-alu-5052',
    techTags: ['Fiber Laser', 'CNC Press Brake', 'PEM Insertion', 'Powder Coated'],
    specs: {
      tolerance: '± 0.10 mm',
      leadTime: '2 - 4 Days',
      keyMetricLabel: 'Sheet Thickness Range',
      keyMetricValue: '0.5 - 20 mm',
      standard: 'ISO 2768-m',
    },
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
  {
    id: 'digital-fabrication-tooling',
    translationId: 'tooling',
    title: 'Digital Fabrication & Rapid Tooling',
    category: 'Bridge & Volume Tooling',
    description: 'Rapid aluminum injection mold tooling and vacuum urethane casting for bridge production, pre-series qualification, and rapid scaling.',
    materialRef: 'pa12-sls',
    techTags: ['Bridge Tooling', 'Urethane Casting', '100 - 10,000 Pcs', 'Fast Mold Cycling'],
    specs: {
      tolerance: '± 0.05 mm',
      leadTime: '7 - 12 Days',
      keyMetricLabel: 'Batch Scaling',
      keyMetricValue: '100 - 50k+ pcs',
      standard: 'SPI Mold Class 104',
    },
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

export const ServicesSection: React.FC = () => {
  const { startManufacturingRequest } = useStore();
  const { t } = useTranslation();

  return (
    <SectionReveal
      className="section-padding services-section"
      id="services-section"
    >
      <div className="container">
        <div className="section-header">
          <div className="section-badge">
            <span className="section-badge-dot"></span>
            <span>{t('sections.capabilities')}</span>
          </div>
          <h2 className="section-title">{t('sections.servicesTitle')}</h2>
          <p className="section-subtitle">
            {t('sections.servicesDescription')}
          </p>
        </div>

        <StaggerReveal className="services-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
          {SERVICES_CATALOG.map((service) => (
            <div
              key={service.id}
              className="card card-interactive service-card"
              onClick={() => startManufacturingRequest()}
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                <div className="service-icon-wrapper">
                  {service.iconSvg}
                </div>
                <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
                  {t(`service.${service.translationId}.category`)}
                </span>
              </div>

              <h3 className="card-title" style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>
                {t(`service.${service.translationId}.title`)}
              </h3>

              <p className="card-description" style={{ flexGrow: 1, marginBottom: 'var(--space-4)' }}>
                {t(`service.${service.translationId}.description`)}
              </p>

              <div className="service-tech-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-4)' }}>
                {service.techTags.map((tag) => (
                  <span key={tag} className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className="service-spec-matrix" style={{ marginTop: 'auto', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--cam-border-subtle)' }}>
                <div className="spec-entry">
                  <span className="spec-key">{t('service.tolerance')}</span>
                  <span className="spec-val" style={{ color: 'var(--cam-cyan-tech)' }}>{service.specs.tolerance}</span>
                </div>
                <div className="spec-entry">
                  <span className="spec-key">{t('service.leadTime')}</span>
                  <span className="spec-val" style={{ color: 'var(--cam-success)' }}>{service.specs.leadTime}</span>
                </div>
                <div className="spec-entry">
                  <span className="spec-key">{service.specs.keyMetricLabel}</span>
                  <span className="spec-val">{service.specs.keyMetricValue}</span>
                </div>
                <div className="spec-entry">
                  <span className="spec-key">{t('service.standard')}</span>
                  <span className="spec-val">{service.specs.standard}</span>
                </div>
              </div>

              <div style={{ marginTop: 'var(--space-4)' }}>
                <button
                  className="btn btn-sm btn-primary"
                  style={{ width: '100%' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    startManufacturingRequest();
                  }}
                >
                  {t('actions.configure')} {t(`service.${service.translationId}.title`)}
                </button>
              </div>
            </div>
          ))}
        </StaggerReveal>
      </div>
    </SectionReveal>
  );
};
