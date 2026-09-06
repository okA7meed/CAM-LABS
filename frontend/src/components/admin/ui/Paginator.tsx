import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../ui/Icon';

export const Paginator: React.FC<{
  total: number;
  page: number;
  limit: number;
  loading?: boolean;
  rangeLabel?: string;
  onPageChange: (page: number) => void;
}> = ({ total, page, limit, loading, rangeLabel, onPageChange }) => {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : page * limit + 1;
  const end = total === 0 ? 0 : Math.min(total, (page + 1) * limit);

  return (
    <div className="admin-pagination">
      <span className="admin-pagination-range">
        {rangeLabel || t('admin.pagination.showing', { start, end, total })}
      </span>
      <div className="admin-pagination-controls">
        <button
          type="button"
          className="btn btn-sm btn-outline"
          disabled={loading || page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <Icon name="arrowLeft" size={14} />
          {t('admin.lists.previous')}
        </button>
        <span className="admin-pagination-page">
          {t('admin.pagination.pageOf', { page: page + 1, totalPages })}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          disabled={loading || page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
        >
          {t('admin.lists.next')}
          <Icon name="arrowRight" size={14} />
        </button>
      </div>
    </div>
  );
};