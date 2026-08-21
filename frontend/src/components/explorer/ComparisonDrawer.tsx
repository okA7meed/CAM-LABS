import React from 'react';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';

export const ComparisonDrawer: React.FC = () => {
  const { comparisonList, clearComparison, openComparisonModal } = useStore();
  const { t } = useTranslation();

  if (comparisonList.length === 0) return null;

  return (
    <div className="comparison-floating-bar active">
      <span className="mono-tag" style={{ color: 'var(--cam-text-primary)' }}>
        {t('comparison.selected', { count: comparisonList.length })}
      </span>
      <button className="btn btn-sm btn-primary" onClick={openComparisonModal}>
        {t('comparison.sideBySide')}
      </button>
      <button className="btn btn-sm btn-ghost" onClick={clearComparison}>
        {t('comparison.clear')}
      </button>
    </div>
  );
};
