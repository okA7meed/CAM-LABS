import React from 'react';
import { useStore } from '../../context/StoreContext';
import { ViewType } from '../../types';
import { Logo } from './Logo';
import { useTranslation } from 'react-i18next';
import { FooterReveal } from '../ui/Reveal';

export const Footer: React.FC = () => {
  const { setActiveView } = useStore();
  const { t } = useTranslation();

  const handleLink = (view: ViewType, sectionId?: string) => {
    setActiveView(view);
    if (sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <FooterReveal className="cam-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand Column */}
          <div className="footer-col-brand">
            <Logo className="footer-logo" alt="CAM LABS" />
            <p className="footer-desc">
              {t('footer.description')}
            </p>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--cam-text-muted)' }}>
              {t('footer.compliance')}
            </div>
          </div>

          {/* Technologies Column */}
          <div>
            <div className="footer-heading">{t('footer.technologies')}</div>
            <ul className="footer-links">
              <li><a href="#materials" onClick={(e) => { e.preventDefault(); handleLink('materials', 'materials-section'); }}>{t('footer.sls')}</a></li>
              <li><a href="#materials" onClick={(e) => { e.preventDefault(); handleLink('materials', 'materials-section'); }}>{t('footer.sla')}</a></li>
              <li><a href="#materials" onClick={(e) => { e.preventDefault(); handleLink('materials', 'materials-section'); }}>{t('footer.cnc')}</a></li>
              <li><a href="#materials" onClick={(e) => { e.preventDefault(); handleLink('materials', 'materials-section'); }}>{t('footer.dmls')}</a></li>
              <li><a href="#materials" onClick={(e) => { e.preventDefault(); handleLink('materials', 'materials-section'); }}>{t('footer.sheetMetal')}</a></li>
              <li><a href="#materials" onClick={(e) => { e.preventDefault(); handleLink('materials', 'materials-section'); }}>{t('footer.injection')}</a></li>
            </ul>
          </div>

          {/* Materials Column */}
          <div>
            <div className="footer-heading">{t('footer.materials')}</div>
            <ul className="footer-links">
              <li><a href="#materials" onClick={(e) => { e.preventDefault(); handleLink('materials', 'materials-section'); }}>{t('footer.pa12')}</a></li>
              <li><a href="#materials" onClick={(e) => { e.preventDefault(); handleLink('materials', 'materials-section'); }}>{t('footer.peek')}</a></li>
              <li><a href="#materials" onClick={(e) => { e.preventDefault(); handleLink('materials', 'materials-section'); }}>{t('footer.aluminum')}</a></li>
              <li><a href="#materials" onClick={(e) => { e.preventDefault(); handleLink('materials', 'materials-section'); }}>{t('footer.steel')}</a></li>
              <li><a href="#materials" onClick={(e) => { e.preventDefault(); handleLink('materials', 'materials-section'); }}>{t('footer.titanium')}</a></li>
              <li><a href="#materials" onClick={(e) => { e.preventDefault(); handleLink('materials', 'materials-section'); }}>{t('footer.resins')}</a></li>
            </ul>
          </div>

          {/* Platform Column */}
          <div>
            <div className="footer-heading">{t('footer.platform')}</div>
            <ul className="footer-links">
              <li><a href="#dashboard" onClick={(e) => { e.preventDefault(); handleLink('dashboard'); }}>{t('footer.customerDashboard')}</a></li>
              <li><a href="#workflow" onClick={(e) => { e.preventDefault(); handleLink('workflow', 'workflow-section'); }}>{t('footer.dfmRules')}</a></li>
              <li><a href="#capabilities-section" onClick={(e) => { e.preventDefault(); handleLink('home', 'capabilities-section'); }}>{t('footer.cmmProtocol')}</a></li>
              <li><a href="#profile" onClick={(e) => { e.preventDefault(); handleLink('profile'); }}>{t('footer.enterpriseIntegration')}</a></li>
              <li><a href="#home" onClick={(e) => { e.preventDefault(); handleLink('home'); }}>{t('footer.networkStatus')}</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            {t('footer.rights')}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <a href="#home">{t('footer.privacy')}</a>
            <a href="#home">{t('footer.terms')}</a>
            <a href="#home">{t('footer.nda')}</a>
            <a href="#home">{t('footer.security')}</a>
          </div>
        </div>
      </div>
    </FooterReveal>
  );
};
