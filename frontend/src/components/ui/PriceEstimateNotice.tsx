import React from 'react';
import { useTranslation } from 'react-i18next';

export const PriceEstimateNotice: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="price-estimate-notice" role="note">
      {t('request.priceEstimateNotice')}
    </div>
  );
};