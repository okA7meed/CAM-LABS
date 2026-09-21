import React from 'react';
import { useTranslation } from 'react-i18next';
import { LegalPageShell, LegalSection } from './LegalPageShell';

export const SecurityView: React.FC = () => {
  const { t } = useTranslation();
  return (
    <LegalPageShell
      viewId="view-security"
      eyebrowKey="security.eyebrow"
      titleKey="security.title"
      statementKey="security.statement"
      toc={[
        { id: 'security-account', titleKey: 'security.s1t' },
        { id: 'security-access', titleKey: 'security.s2t' },
        { id: 'security-files', titleKey: 'security.s3t' },
        { id: 'security-admin', titleKey: 'security.s4t' },
        { id: 'security-audit', titleKey: 'security.s5t' },
        { id: 'security-payments', titleKey: 'security.s6t' },
        { id: 'security-monitoring', titleKey: 'security.s7t' },
        { id: 'security-practices', titleKey: 'security.s8t' },
        { id: 'security-report', titleKey: 'security.s9t' },
      ]}
    >
      <p className="legal-lead">{t('security.intro')}</p>

      <LegalSection id="security-account" titleKey="security.s1t">
        <p>{t('security.s1d1')}</p>
        <p>{t('security.s1d2')}</p>
      </LegalSection>

      <LegalSection id="security-access" titleKey="security.s2t">
        <p>{t('security.s2d1')}</p>
        <p>{t('security.s2d2')}</p>
      </LegalSection>

      <LegalSection id="security-files" titleKey="security.s3t">
        <p>{t('security.s3d1')}</p>
      </LegalSection>

      <LegalSection id="security-admin" titleKey="security.s4t">
        <p>{t('security.s4d1')}</p>
      </LegalSection>

      <LegalSection id="security-audit" titleKey="security.s5t">
        <p>{t('security.s5d1')}</p>
      </LegalSection>

      <LegalSection id="security-payments" titleKey="security.s6t">
        <p>{t('security.s6d1')}</p>
        <p>{t('security.s6d2')}</p>
      </LegalSection>

      <LegalSection id="security-monitoring" titleKey="security.s7t">
        <p>{t('security.s7d1')}</p>
      </LegalSection>

      <LegalSection id="security-practices" titleKey="security.s8t">
        <p>{t('security.s8d1')}</p>
        <p>{t('security.s8d2')}</p>
      </LegalSection>

      <LegalSection id="security-report" titleKey="security.s9t">
        <p>{t('security.s9d1')}</p>
        <p>{t('security.s9d2')}</p>
      </LegalSection>
    </LegalPageShell>
  );
};
