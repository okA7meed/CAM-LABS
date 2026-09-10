import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

export const PriceEstimateNotice: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="price-estimate-notice" role="note">
      <span className="price-estimate-notice-icon" aria-hidden="true"><Icon name="alert" size={13} /></span>
      <span>{t('request.priceEstimateNotice')}</span>
    </div>
  );
};