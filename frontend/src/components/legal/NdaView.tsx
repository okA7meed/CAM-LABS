import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { LegalPageShell, LegalSection } from './LegalPageShell';

const FILE_ITEMS = ['cad', 'drawings', 'designs', 'dims', 'materials', 'production'] as const;
const USE_ITEMS = ['quoting', 'review', 'mfg', 'inspection', 'delivery', 'support'] as const;

export const NdaView: React.FC = () => {
  const { t } = useTranslation();
  const { setActiveView } = useStore();
  return (
    <LegalPageShell
      viewId="view-nda"
      eyebrowKey="nda.eyebrow"
      titleKey="nda.title"
      statementKey="nda.statement"
      updatedKey="nda.updated"
      toc={[
        { id: 'nda-yours', titleKey: 'nda.s1t' },
        { id: 'nda-files', titleKey: 'nda.s2t' },
        { id: 'nda-access', titleKey: 'nda.s3t' },
        { id: 'nda-requests', titleKey: 'nda.s4t' },
        { id: 'nda-ownership', titleKey: 'nda.s5t' },
        { id: 'nda-partners', titleKey: 'nda.s6t' },
        { id: 'nda-use', titleKey: 'nda.s7t' },
        { id: 'nda-retention', titleKey: 'nda.s8t' },
        { id: 'nda-cta', titleKey: 'nda.s9t' },
      ]}
    >
      <p className="legal-lead">{t('nda.intro')}</p>

      <LegalSection id="nda-yours" titleKey="nda.s1t">
        <p>{t('nda.s1d1')}</p>
        <p>{t('nda.s1d2')}</p>
      </LegalSection>

      <LegalSection id="nda-files" titleKey="nda.s2t">
        <p>{t('nda.s2d1')}</p>
        <ul>
          {FILE_ITEMS.map((k) => (
            <li key={k}>{t(`nda.file_${k}`)}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="nda-access" titleKey="nda.s3t">
        <p>{t('nda.s3d1')}</p>
        <p>{t('nda.s3d2')}</p>
      </LegalSection>

      <LegalSection id="nda-requests" titleKey="nda.s4t">
        <p>{t('nda.s4d1')}</p>
        <p>{t('nda.s4d2')}</p>
      </LegalSection>

      <LegalSection id="nda-ownership" titleKey="nda.s5t">
        <p>{t('nda.s5d1')}</p>
      </LegalSection>

      <LegalSection id="nda-partners" titleKey="nda.s6t">
        <p>{t('nda.s6d1')}</p>
      </LegalSection>

      <LegalSection id="nda-use" titleKey="nda.s7t">
        <p>{t('nda.s7d1')}</p>
        <ul>
          {USE_ITEMS.map((k) => (
            <li key={k}>{t(`nda.use_${k}`)}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="nda-retention" titleKey="nda.s8t">
        <p>{t('nda.s8d1')}</p>
      </LegalSection>

      <LegalSection id="nda-cta" titleKey="nda.s9t">
        <p>{t('nda.s9d1')}</p>
        <p>{t('nda.s9d2')}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setActiveView('contact');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          {t('nda.s9cta')}
        </button>
      </LegalSection>
    </LegalPageShell>
  );
};
