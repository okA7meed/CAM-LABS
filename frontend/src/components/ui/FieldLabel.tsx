import React from 'react';
import { useTranslation } from 'react-i18next';

/** Red required indicator. Pair with `required` and `aria-required` on the input. */
export const RequiredMark: React.FC = () => {
  const { t } = useTranslation();
  return (
    <span className="required-mark" aria-hidden="true">
      {t('common.requiredMark')}
    </span>
  );
};

/** Muted "(Optional)" indicator for non-mandatory field labels. */
export const OptionalMark: React.FC = () => {
  const { t } = useTranslation();
  return (
    <span className="form-label-optional" aria-hidden="true">
      {t('common.optionalMark')}
    </span>
  );
};
