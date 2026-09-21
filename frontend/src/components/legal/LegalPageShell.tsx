import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { Icon } from '../ui/Icon';

export interface LegalTocEntry {
  id: string;
  titleKey: string;
}

interface LegalPageShellProps {
  viewId: string;
  eyebrowKey: string;
  titleKey: string;
  statementKey: string;
  updatedKey?: string;
  toc: LegalTocEntry[];
  children: React.ReactNode;
  /** Hide the contact CTA (used by the contact page itself). */
  hideContactCta?: boolean;
  /** Hide the FAQ CTA (used by the FAQ page itself). */
  hideFaqCta?: boolean;
}

/**
 * Shared shell for CAM LABS legal / trust / support pages.
 * Dark-navy hero, sticky desktop table of contents, readable article
 * typography, and a support CTA band — all on the existing site shell
 * (Navbar above, approved Footer below).
 */
export const LegalPageShell: React.FC<LegalPageShellProps> = ({
  viewId,
  eyebrowKey,
  titleKey,
  statementKey,
  updatedKey,
  toc,
  children,
  hideContactCta,
  hideFaqCta,
}) => {
  const { t } = useTranslation();
  const { setActiveView } = useStore();

  const goTop = (view: 'home' | 'contact' | 'faq') => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const headerH = document.querySelector('.cam-header')?.getBoundingClientRect().height ?? 72;
    const targetTop = el.getBoundingClientRect().top + window.scrollY - headerH - 16;
    window.scrollTo({ top: targetTop, behavior: 'smooth' });
  };

  return (
    <main className="legal-page" id={viewId}>
      <div className="legal-hero">
        <div className="container">
          <nav className="legal-crumb" aria-label="Breadcrumb">
            <button type="button" onClick={() => goTop('home')}>
              {t('legal.home')}
            </button>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{t(titleKey)}</span>
          </nav>
          <p className="legal-eyebrow">{t(eyebrowKey)}</p>
          <h1 className="legal-title">{t(titleKey)}</h1>
          <p className="legal-statement">{t(statementKey)}</p>
          {updatedKey ? <p className="legal-updated">{t(updatedKey)}</p> : null}
        </div>
      </div>

      <div className="container legal-body">
        {toc.length > 0 ? (
          <aside className="legal-toc" aria-label={t('legal.toc')}>
            <p className="legal-toc-heading">{t('legal.toc')}</p>
            <ul>
              {toc.map((entry) => (
                <li key={entry.id}>
                  <button type="button" onClick={() => scrollToSection(entry.id)}>
                    {t(entry.titleKey)}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
        <article className="legal-article">{children}</article>
      </div>

      {hideContactCta && hideFaqCta ? null : (
        <div className="container">
          <section className="legal-cta" aria-label={t('legal.stillQuestions')}>
            <div>
              <h2>{t('legal.stillQuestions')}</h2>
              <p>{t('legal.stillQuestionsSub')}</p>
            </div>
            <div className="legal-cta-actions">
              {hideContactCta ? null : (
                <button type="button" className="btn btn-primary" onClick={() => goTop('contact')}>
                  <Icon name="mail" size={16} />
                  {t('legal.contactCta')}
                </button>
              )}
              {hideFaqCta ? null : (
                <button type="button" className="btn btn-outline" onClick={() => goTop('faq')}>
                  <Icon name="clipboard" size={16} />
                  {t('legal.faqCta')}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
};

interface LegalSectionProps {
  id: string;
  titleKey: string;
  children: React.ReactNode;
}

export const LegalSection: React.FC<LegalSectionProps> = ({ id, titleKey, children }) => {
  const { t } = useTranslation();
  return (
    <section className="legal-section" id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t(titleKey)}</h2>
      {children}
    </section>
  );
};
