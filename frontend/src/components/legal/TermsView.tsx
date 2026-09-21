import React from 'react';
import { useTranslation } from 'react-i18next';
import { LegalPageShell, LegalSection } from './LegalPageShell';

export const TermsView: React.FC = () => {
  const { t } = useTranslation();
  return (
    <LegalPageShell
      viewId="view-terms"
      eyebrowKey="terms.eyebrow"
      titleKey="terms.title"
      statementKey="terms.statement"
      updatedKey="terms.updated"
      toc={[
        { id: 'terms-quotes', titleKey: 'terms.s1t' },
        { id: 'terms-pricing', titleKey: 'terms.s2t' },
        { id: 'terms-design', titleKey: 'terms.s3t' },
        { id: 'terms-dfm', titleKey: 'terms.s4t' },
        { id: 'terms-materials', titleKey: 'terms.s5t' },
        { id: 'terms-tolerances', titleKey: 'terms.s6t' },
        { id: 'terms-finish', titleKey: 'terms.s7t' },
        { id: 'terms-quality', titleKey: 'terms.s8t' },
        { id: 'terms-changes', titleKey: 'terms.s9t' },
        { id: 'terms-lead', titleKey: 'terms.s10t' },
        { id: 'terms-payment', titleKey: 'terms.s11t' },
        { id: 'terms-shipping', titleKey: 'terms.s12t' },
        { id: 'terms-nonconforming', titleKey: 'terms.s13t' },
        { id: 'terms-ip', titleKey: 'terms.s14t' },
        { id: 'terms-prohibited', titleKey: 'terms.s15t' },
      ]}
    >
      <p className="legal-lead">{t('terms.intro')}</p>

      <LegalSection id="terms-quotes" titleKey="terms.s1t">
        <p>{t('terms.s1d1')}</p>
        <p>{t('terms.s1d2')}</p>
        <p>{t('terms.s1d3')}</p>
      </LegalSection>

      <LegalSection id="terms-pricing" titleKey="terms.s2t">
        <p>{t('terms.s2d1')}</p>
        <ul>
          {['geometry', 'material', 'process', 'quantity', 'tolerances', 'finish', 'inspection', 'shipping'].map((k) => (
            <li key={k}>{t(`terms.price_${k}`)}</li>
          ))}
        </ul>
        <p>{t('terms.s2d2')}</p>
      </LegalSection>

      <LegalSection id="terms-design" titleKey="terms.s3t">
        <p>{t('terms.s3d1')}</p>
        <p>{t('terms.s3d2')}</p>
      </LegalSection>

      <LegalSection id="terms-dfm" titleKey="terms.s4t">
        <p>{t('terms.s4d1')}</p>
        <ul>
          {['geometry', 'features', 'walls', 'tooling', 'tolerances', 'limits'].map((k) => (
            <li key={k}>{t(`terms.dfm_${k}`)}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="terms-materials" titleKey="terms.s5t">
        <p>{t('terms.s5d1')}</p>
        <p>{t('terms.s5d2')}</p>
      </LegalSection>

      <LegalSection id="terms-tolerances" titleKey="terms.s6t">
        <p>{t('terms.s6d1')}</p>
        <p>{t('terms.s6d2')}</p>
      </LegalSection>

      <LegalSection id="terms-finish" titleKey="terms.s7t">
        <p>{t('terms.s7d1')}</p>
        <p>{t('terms.s7d2')}</p>
      </LegalSection>

      <LegalSection id="terms-quality" titleKey="terms.s8t">
        <p>{t('terms.s8d1')}</p>
        <p>{t('terms.s8d2')}</p>
      </LegalSection>

      <LegalSection id="terms-changes" titleKey="terms.s9t">
        <p>{t('terms.s9d1')}</p>
        <p>{t('terms.s9d2')}</p>
      </LegalSection>

      <LegalSection id="terms-lead" titleKey="terms.s10t">
        <p>{t('terms.s10d1')}</p>
        <ul>
          {['design', 'material', 'requirements', 'quality', 'external'].map((k) => (
            <li key={k}>{t(`terms.lead_${k}`)}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="terms-payment" titleKey="terms.s11t">
        <p>{t('terms.s11d1')}</p>
        <p>{t('terms.s11d2')}</p>
      </LegalSection>

      <LegalSection id="terms-shipping" titleKey="terms.s12t">
        <p>{t('terms.s12d1')}</p>
        <p>{t('terms.s12d2')}</p>
      </LegalSection>

      <LegalSection id="terms-nonconforming" titleKey="terms.s13t">
        <p>{t('terms.s13d1')}</p>
        <p>{t('terms.s13d2')}</p>
      </LegalSection>

      <LegalSection id="terms-ip" titleKey="terms.s14t">
        <p>{t('terms.s14d1')}</p>
        <p>{t('terms.s14d2')}</p>
      </LegalSection>

      <LegalSection id="terms-prohibited" titleKey="terms.s15t">
        <p>{t('terms.s15d1')}</p>
      </LegalSection>
    </LegalPageShell>
  );
};
