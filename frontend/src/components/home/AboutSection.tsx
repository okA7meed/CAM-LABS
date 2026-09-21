import React from 'react';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';
import { SectionReveal, StaggerReveal } from '../ui/Reveal';
import { Icon } from '../ui/Icon';

export const AboutSection: React.FC = () => {
  const { openComingSoon } = useStore();
  const { t } = useTranslation();

  // Two-tone heading: leading words in icy white, remainder in technical
  // blue. Word-based so Arabic RTL keeps natural word order (rendered
  // inline there, stacked in LTR via CSS).
  const titleWords = t('about.title').split(' ').filter(Boolean);
  const titleLead = titleWords.slice(0, 2).join(' ') || t('about.title');
  const titleRest = titleWords.slice(2).join(' ');

  const valueProps: {
    number: string;
    title: string;
    subtitle: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      number: '01',
      title: t('about.dfmTitle'), subtitle: t('about.dfmSubtitle'), desc: t('about.dfmDescription'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      number: '02',
      title: t('about.ipTitle'), subtitle: t('about.ipSubtitle'), desc: t('about.ipDescription'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      number: '03',
      title: t('about.nodesTitle'), subtitle: t('about.nodesSubtitle'), desc: t('about.nodesDescription'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
    {
      number: '04',
      title: t('about.cmmTitle'), subtitle: t('about.cmmSubtitle'), desc: t('about.cmmDescription'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M3 12h3M18 12h3M12 3v3M12 18v3" />
        </svg>
      ),
    },
    {
      number: '05',
      title: t('about.rapidTitle'), subtitle: t('about.rapidSubtitle'), desc: t('about.rapidDescription'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 14 14" />
        </svg>
      ),
    },
    {
      number: '06',
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
      className="section-padding about-section"
      id="about"
    >
      <div className="about-overlay" aria-hidden="true" />
      <span className="about-annotation about-annotation-left" aria-hidden="true">
        {t('about.annotationLeft')}
      </span>
      <span className="about-annotation about-annotation-right" aria-hidden="true">
        <strong>{t('about.annotationRightValue')}</strong>
        <span>{t('about.annotationRightLabel')}</span>
      </span>

      <div className="container about-container">
        {/* Section Header */}
        <div className="section-header">
          <div className="section-badge">
            <span className="section-badge-dot"></span>
            <span>{t('about.kicker')}</span>
          </div>
          <h2 className="section-title about-title">
            <span className="about-title-lead">{titleLead}</span>{' '}
            {titleRest ? <span className="about-title-rest">{titleRest}</span> : null}
          </h2>
          <p className="section-subtitle">
            {t('about.description')}
          </p>
        </div>

        {/* Value Proposition Grid */}
        <StaggerReveal className="about-grid">
          {valueProps.map((vp) => (
            <article key={vp.number} className="about-card">
              <div className="about-card-top">
                <span className="about-icon-box">
                  {vp.icon}
                </span>
                <span className="about-card-titles">
                  <h3 className="about-card-title">{vp.title}</h3>
                  <span className="about-card-subtitle">{vp.subtitle}</span>
                </span>
                <span className="about-card-number">{vp.number}</span>
              </div>
              <p className="about-card-desc">{vp.desc}</p>
              <span className="about-card-arrow" aria-hidden="true">
                <Icon name="arrowRight" size={16} />
              </span>
            </article>
          ))}
        </StaggerReveal>

        {/* Company Mission Banner */}
        <div className="about-mission">
          <div className="about-mission-copy">
            <div className="about-mission-label">
              {t('about.missionLabel')}
            </div>
            <h3 className="about-mission-title">
              {t('about.missionTitle')}
            </h3>
            <p className="about-mission-desc">
              {t('about.missionDescription')}
            </p>
          </div>
          <div className="about-mission-cta">
            <button type="button" className="btn btn-primary about-mission-btn" onClick={() => openComingSoon()}>
              {t('about.startRequest')}
              <span className="about-mission-btn-arrow" aria-hidden="true">
                <Icon name="arrowRight" size={16} />
              </span>
            </button>
            <p className="about-mission-micro">{t('about.ctaMicrocopy')}</p>
          </div>
        </div>
      </div>
    </SectionReveal>
  );
};
