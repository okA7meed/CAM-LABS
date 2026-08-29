import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { Logo } from '../layout/Logo';

export const ComingSoonView: React.FC = () => {
  const { t } = useTranslation();
  const { setActiveView } = useStore();

  const handleBackHome = () => {
    setActiveView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main id="view-coming-soon" className="coming-soon-view">
      <div className="container coming-soon-wrap">
        <div className="coming-soon-card">
          <div className="coming-soon-mark" aria-hidden="true">
            <Logo className="coming-soon-logo" />
          </div>

          <span className="coming-soon-kicker">{t('comingSoon.kicker')}</span>

          <h1 className="coming-soon-title">{t('comingSoon.title')}</h1>
          <p className="coming-soon-description">{t('comingSoon.description')}</p>

          <div className="coming-soon-contact">
            <span className="coming-soon-contact-label">{t('comingSoon.contactLabel')}</span>
            <a
              className="coming-soon-email"
              href="mailto:CAMLABS@gmail.com"
              dir="ltr"
            >
              CAMLABS@gmail.com
            </a>
          </div>

          <button className="btn btn-primary coming-soon-back" onClick={handleBackHome}>
            {t('comingSoon.backHome')}
          </button>
        </div>
      </div>
    </main>
  );
};
