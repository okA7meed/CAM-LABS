import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '../ui/Icon';
import { SectionReveal, StaggerReveal } from '../ui/Reveal';

interface WorkflowStep {
  id: string;
  number: string;
  icon: IconName;
  titleKey: string;
  descriptionKey: string;
}

const STEPS: readonly WorkflowStep[] = [
  {
    id: 'upload',
    number: '01',
    icon: 'upload',
    titleKey: 'workflow.uploadTitle',
    descriptionKey: 'workflow.uploadDescription',
  },
  {
    id: 'configure',
    number: '02',
    icon: 'calculator',
    titleKey: 'workflow.configureTitle',
    descriptionKey: 'workflow.configureDescription',
  },
  {
    id: 'fabrication',
    number: '03',
    icon: 'cube',
    titleKey: 'workflow.fabricationTitle',
    descriptionKey: 'workflow.fabricationDescription',
  },
  {
    id: 'qa',
    number: '04',
    icon: 'cube',
    titleKey: 'workflow.qaTitle',
    descriptionKey: 'workflow.qaDescription',
  },
];

export const WorkflowSection: React.FC = () => {
  const { t } = useTranslation();
  return (
    <SectionReveal className="section-padding workflow-section" id="workflow-section">
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
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              {index > 0 && (
                <div className="workflow-connector" aria-hidden="true">
                  <div className="workflow-connector-inner">
                    <span className="workflow-connector-rail"></span>
                    <span className="workflow-connector-circle">
                      <Icon name="arrowRight" size={18} className="workflow-connector-icon" />
                    </span>
                    <span className="workflow-connector-rail"></span>
                  </div>
                </div>
              )}
              <article className="workflow-card">
                <span className="workflow-card-number" data-number={step.number} aria-hidden="true">
                  {step.number}
                </span>
                <div className="workflow-card-content">
                  <div className="workflow-card-icon-box">
                    <Icon name={step.icon} size={22} />
                  </div>
                  <h3 className="workflow-card-title">{t(step.titleKey)}</h3>
                  <p className="workflow-card-desc">{t(step.descriptionKey)}</p>
                </div>
                <span className="workflow-card-accent" aria-hidden="true"></span>
              </article>
            </React.Fragment>
          ))}
        </StaggerReveal>
      </div>
    </SectionReveal>
  );
};