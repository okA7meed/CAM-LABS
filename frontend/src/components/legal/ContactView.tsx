import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { LegalPageShell, LegalSection } from './LegalPageShell';
import { Icon } from '../ui/Icon';

/** Backend-configured default support address (SystemSetting.supportEmail
 *  fallback in admin.service). surfaced here as the real contact channel. */
export const SUPPORT_EMAIL = 'support@cam-labs.com';

export const ContactView: React.FC = () => {
  const { t } = useTranslation();
  const { setActiveView, startManufacturingRequest, showToast } = useStore();
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      showToast(t('contact.copied'), SUPPORT_EMAIL, 'success');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast(t('contact.copyFailed'), SUPPORT_EMAIL, 'warning');
    }
  };

  return (
    <LegalPageShell
      viewId="view-contact"
      eyebrowKey="contact.eyebrow"
      titleKey="contact.title"
      statementKey="contact.statement"
      toc={[
        { id: 'contact-channels', titleKey: 'contact.s1t' },
        { id: 'contact-before', titleKey: 'contact.s2t' },
        { id: 'contact-sensitive', titleKey: 'contact.s3t' },
      ]}
      hideContactCta
    >
      <p className="legal-lead">{t('contact.intro')}</p>

      <LegalSection id="contact-channels" titleKey="contact.s1t">
        <div className="contact-cards">
          <div className="contact-card">
            <span className="contact-card-icon" aria-hidden="true">
              <Icon name="mail" size={22} />
            </span>
            <div>
              <h3>{t('contact.emailTitle')}</h3>
              <p>{t('contact.emailSub')}</p>
              <div className="contact-email-row">
                <a className="contact-email" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void copyEmail()}>
                  <Icon name={copied ? 'check' : 'copy'} size={14} />
                  {t(copied ? 'contact.copiedShort' : 'contact.copy')}
                </button>
              </div>
            </div>
          </div>
          <div className="contact-card">
            <span className="contact-card-icon" aria-hidden="true">
              <Icon name="clipboard" size={22} />
            </span>
            <div>
              <h3>{t('contact.faqTitle')}</h3>
              <p>{t('contact.faqSub')}</p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setActiveView('faq');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {t('legal.faqCta')}
              </button>
            </div>
          </div>
          <div className="contact-card">
            <span className="contact-card-icon" aria-hidden="true">
              <Icon name="plusCircle" size={22} />
            </span>
            <div>
              <h3>{t('contact.quoteTitle')}</h3>
              <p>{t('contact.quoteSub')}</p>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => startManufacturingRequest()}>
                {t('contact.quoteCta')}
              </button>
            </div>
          </div>
        </div>
      </LegalSection>

      <LegalSection id="contact-before" titleKey="contact.s2t">
        <p>{t('contact.s2d1')}</p>
        <ul>
          {['reference', 'files', 'specs', 'timeline'].map((k) => (
            <li key={k}>{t(`contact.tip_${k}`)}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="contact-sensitive" titleKey="contact.s3t">
        <p>{t('contact.s3d1')}</p>
        <p>{t('contact.s3d2')}</p>
      </LegalSection>
    </LegalPageShell>
  );
};
