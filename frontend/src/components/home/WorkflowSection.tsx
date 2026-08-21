import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../ui/Icon';
import { SectionReveal, StaggerReveal } from '../ui/Reveal';

export const WorkflowSection: React.FC = () => {
  const { t } = useTranslation();
  return (
    <SectionReveal className="section-padding" id="workflow-section">
      <div className="container">
        <div className="section-header">
          <div className="section-badge">
            <span className="section-badge-dot"></span>
            <span>{t('workflow.kicker')}</span>
          </div>
          <h2 className="section-title">{t('workflow.title')}</h2>
          <p className="section-subtitle">
            {t('workflow.description')}
          </p>
        </div>

        <StaggerReveal className="workflow-stepper-grid">
          <div className="step-card">
            <div className="step-number">
              <span>01</span>
              <Icon name="upload" size={28} className="step-icon" />
            </div>
            <div className="step-title">{t('workflow.uploadTitle')}</div>
            <p className="step-desc">
              {t('workflow.uploadDescription')}
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">
              <span>02</span>
              <Icon name="configure" size={28} className="step-icon" />
            </div>
            <div className="step-title">{t('workflow.configureTitle')}</div>
            <p className="step-desc">
              {t('workflow.configureDescription')}
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">
              <span>03</span>
              <Icon name="technology" size={28} className="step-icon" />
            </div>
            <div className="step-title">{t('workflow.fabricationTitle')}</div>
            <p className="step-desc">
              {t('workflow.fabricationDescription')}
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">
              <span>04</span>
              <Icon name="check" size={28} className="step-icon" />
            </div>
            <div className="step-title">{t('workflow.qaTitle')}</div>
            <p className="step-desc">
              {t('workflow.qaDescription')}
            </p>
          </div>
        </StaggerReveal>
      </div>
    </SectionReveal>
  );
};
