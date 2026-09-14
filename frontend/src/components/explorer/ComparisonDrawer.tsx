import React from 'react';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';

export const ComparisonDrawer: React.FC = () => {
  const { comparisonList, clearComparison, openComparisonModal } = useStore();
  const { t } = useTranslation();
  const count = comparisonList.length;

  return (
    <div className={`comparison-floating-bar ${count > 0 ? 'active' : ''}`} aria-hidden={count === 0}>
      <span className="mono-tag" style={{ color: 'var(--cam-text-primary)' }}>
        {t('comparison.selected', { count })}
      </span>
      <button className="btn btn-sm btn-primary" onClick={openComparisonModal} tabIndex={count > 0 ? 0 : -1}>
        {t('comparison.sideBySide')}
      </button>
      <button className="btn btn-sm btn-ghost" onClick={clearComparison} tabIndex={count > 0 ? 0 : -1}>
        {t('comparison.clear')}
      </button>
    </div>
  );
};