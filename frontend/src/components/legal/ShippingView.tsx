import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LegalPageShell, LegalSection } from './LegalPageShell';
import { ApiService } from '../../services/api';
import { GOVERNORATES } from '../../constants/locations';
import { Icon } from '../ui/Icon';

interface ShippingRate {
  id: string;
  label: string;
  description: string;
  eta: string;
  feeEgp: number;
}

export const ShippingView: React.FC = () => {
  const { t } = useTranslation();
  const [rates, setRates] = useState<ShippingRate[] | null>(null);
  const [ratesError, setRatesError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ApiService.getShippingRates()
      .then((res) => {
        if (!cancelled) setRates(res?.rates ?? []);
      })
      .catch(() => {
        if (!cancelled) setRatesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LegalPageShell
      viewId="view-shipping"
      eyebrowKey="shipping.eyebrow"
      titleKey="shipping.title"
      statementKey="shipping.statement"
      toc={[
        { id: 'shipping-methods', titleKey: 'shipping.s1t' },
        { id: 'shipping-coverage', titleKey: 'shipping.s2t' },
        { id: 'shipping-info', titleKey: 'shipping.s3t' },
        { id: 'shipping-tracking', titleKey: 'shipping.s4t' },
      ]}
    >
      <p className="legal-lead">{t('shipping.intro')}</p>

      <LegalSection id="shipping-methods" titleKey="shipping.s1t">
        <p>{t('shipping.s1d1')}</p>
        {ratesError ? (
          <p className="legal-note" role="alert">
            {t('shipping.ratesError')}
          </p>
        ) : rates === null ? (
          <div className="legal-skeleton" aria-hidden="true">
            <span />
            <span />
          </div>
        ) : rates.length === 0 ? (
          <p className="legal-note">{t('shipping.ratesEmpty')}</p>
        ) : (
          <ul className="shipping-rates">
            {rates.map((rate) => (
              <li key={rate.id} className="shipping-rate">
                <span className="shipping-rate-icon" aria-hidden="true">
                  <Icon name="truck" size={20} />
                </span>
                <span className="shipping-rate-body">
                  <strong>{rate.label}</strong>
                  {rate.description ? <span className="shipping-rate-desc">{rate.description}</span> : null}
                  {rate.eta ? (
                    <span className="shipping-rate-eta">{t('shipping.eta')}: {rate.eta}</span>
                  ) : null}
                </span>
                <span className="shipping-rate-fee">
                  {rate.feeEgp} {t('shipping.egp')}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p>{t('shipping.s1d2')}</p>
      </LegalSection>

      <LegalSection id="shipping-coverage" titleKey="shipping.s2t">
        <p>{t('shipping.s2d1')}</p>
        <p className="legal-tags" aria-label={t('shipping.s2t')}>
          {GOVERNORATES.map((gov) => (
            <span className="legal-tag" key={gov}>
              {gov}
            </span>
          ))}
        </p>
      </LegalSection>

      <LegalSection id="shipping-info" titleKey="shipping.s3t">
        <p>{t('shipping.s3d1')}</p>
        <ul>
          {['recipient', 'phone', 'address', 'city', 'governorate'].map((k) => (
            <li key={k}>{t(`shipping.info_${k}`)}</li>
          ))}
        </ul>
        <p>{t('shipping.s3d2')}</p>
      </LegalSection>

      <LegalSection id="shipping-tracking" titleKey="shipping.s4t">
        <p>{t('shipping.s4d1')}</p>
        <p>{t('shipping.s4d2')}</p>
      </LegalSection>
    </LegalPageShell>
  );
};
