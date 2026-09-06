import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../ui/Icon';

interface OrdersPaginationProps {
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export const OrdersPagination: React.FC<OrdersPaginationProps> = ({ total, page, limit, loading, onPageChange }) => {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : page * limit + 1;
  const end = total === 0 ? 0 : Math.min(total, (page + 1) * limit);

  return (
    <div className="admin-pagination">
      <span className="admin-pagination-range">
        {t('admin.orders.showingRange', { start, end, total })}
      </span>
      <div className="admin-pagination-controls">
        <button
          type="button"
          className="btn btn-sm btn-outline"
          disabled={loading || page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <Icon name="arrowLeft" size={14} />
          {t('admin.orders.previous')}
        </button>
        <span className="admin-pagination-page">
          {t('admin.orders.pageOf', { page: page + 1, totalPages })}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          disabled={loading || page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
        >
          {t('admin.orders.next')}
          <Icon name="arrowRight" size={14} />
        </button>
      </div>
    </div>
  );
};