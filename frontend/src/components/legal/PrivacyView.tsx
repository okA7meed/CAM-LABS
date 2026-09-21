import React from 'react';
import { useTranslation } from 'react-i18next';
import { LegalPageShell, LegalSection } from './LegalPageShell';

const COLLECT_ITEMS = ['name', 'email', 'account', 'billing', 'quotes', 'comms', 'specs'] as const;
const CAD_USES = ['quote', 'dfm', 'material', 'planning', 'mfg', 'quality', 'support'] as const;
const USE_ITEMS = ['accounts', 'quotes', 'orders', 'comms', 'delivery', 'support', 'security', 'improve', 'legal'] as const;
const RIGHT_ITEMS = ['access', 'correct', 'questions', 'requests', 'concerns'] as const;

export const PrivacyView: React.FC = () => {
  const { t } = useTranslation();
  return (
    <LegalPageShell
      viewId="view-privacy"
      eyebrowKey="privacy.eyebrow"
      titleKey="privacy.title"
      statementKey="privacy.statement"
      updatedKey="privacy.updated"
      toc={[
        { id: 'privacy-collect', titleKey: 'privacy.s1t' },
        { id: 'privacy-cad', titleKey: 'privacy.s2t' },
        { id: 'privacy-use', titleKey: 'privacy.s3t' },
        { id: 'privacy-payments', titleKey: 'privacy.s4t' },
        { id: 'privacy-shipping', titleKey: 'privacy.s5t' },
        { id: 'privacy-sharing', titleKey: 'privacy.s6t' },
        { id: 'privacy-security', titleKey: 'privacy.s7t' },
        { id: 'privacy-retention', titleKey: 'privacy.s8t' },
        { id: 'privacy-rights', titleKey: 'privacy.s9t' },
        { id: 'privacy-changes', titleKey: 'privacy.s10t' },
      ]}
    >
      <p className="legal-lead">{t('privacy.intro1')}</p>
      <p>{t('privacy.intro2')}</p>

      <LegalSection id="privacy-collect" titleKey="privacy.s1t">
        <h3>{t('privacy.s1st')}</h3>
        <p>{t('privacy.s1d')}</p>
        <ul>
          {COLLECT_ITEMS.map((k) => (
            <li key={k}>{t(`privacy.collect_${k}`)}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="privacy-cad" titleKey="privacy.s2t">
        <p>{t('privacy.s2d1')}</p>
        <p>{t('privacy.s2d2')}</p>
        <p>{t('privacy.s2d3')}</p>
        <ul>
          {CAD_USES.map((k) => (
            <li key={k}>{t(`privacy.cad_${k}`)}</li>
          ))}
        </ul>
        <p>{t('privacy.s2d4')}</p>
      </LegalSection>

      <LegalSection id="privacy-use" titleKey="privacy.s3t">
        <ul>
          {USE_ITEMS.map((k) => (
            <li key={k}>{t(`privacy.use_${k}`)}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="privacy-payments" titleKey="privacy.s4t">
        <p>{t('privacy.s4d1')}</p>
        <p>{t('privacy.s4d2')}</p>
      </LegalSection>

      <LegalSection id="privacy-shipping" titleKey="privacy.s5t">
        <p>{t('privacy.s5d1')}</p>
        <p>{t('privacy.s5d2')}</p>
      </LegalSection>

      <LegalSection id="privacy-sharing" titleKey="privacy.s6t">
        <p>{t('privacy.s6d1')}</p>
        <p>{t('privacy.s6d2')}</p>
      </LegalSection>

      <LegalSection id="privacy-security" titleKey="privacy.s7t">
        <p>{t('privacy.s7d1')}</p>
        <p>{t('privacy.s7d2')}</p>
      </LegalSection>

      <LegalSection id="privacy-retention" titleKey="privacy.s8t">
        <p>{t('privacy.s8d1')}</p>
        <p>{t('privacy.s8d2')}</p>
      </LegalSection>

      <LegalSection id="privacy-rights" titleKey="privacy.s9t">
        <ul>
          {RIGHT_ITEMS.map((k) => (
            <li key={k}>{t(`privacy.right_${k}`)}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="privacy-changes" titleKey="privacy.s10t">
        <p>{t('privacy.s10d1')}</p>
        <p>{t('privacy.s10d2')}</p>
      </LegalSection>
    </LegalPageShell>
  );
};
