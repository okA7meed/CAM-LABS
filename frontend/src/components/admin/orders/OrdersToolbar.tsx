import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../ui/Icon';
import { AppliedFilters, OrdersFilters } from './types';

interface OrdersToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  filters: AppliedFilters;
  onFilterChange: (patch: Partial<AppliedFilters>) => void;
  facets: OrdersFilters;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  exporting: boolean;
  onExport: () => void;
  onNewOrder: () => void;
}

export const OrdersToolbar: React.FC<OrdersToolbarProps> = ({
  search,
  onSearch,
  filters,
  onFilterChange,
  facets,
  hasActiveFilters,
  onClearFilters,
  exporting,
  onExport,
  onNewOrder,
}) => {
  const { t } = useTranslation();

  return (
    <div className="orders-toolbar">
      <div className="orders-toolbar-main">
        <div className="orders-search">
          <Icon name="search" size={15} className="orders-search-icon" />
          <input
            className="form-control orders-search-input"
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t('admin.orders.searchPlaceholder')}
            aria-label={t('admin.orders.searchPlaceholder')}
          />
          {search && (
            <button type="button" className="orders-search-clear" onClick={() => onSearch('')} aria-label={t('admin.orders.clearSearch')}>
              <Icon name="close" size={13} />
            </button>
          )}
        </div>

        <div className="orders-toolbar-actions">
          <button type="button" className="btn btn-sm btn-outline" onClick={onExport} disabled={exporting}>
            <Icon name="file" size={14} />
            {exporting ? t('admin.orders.exporting') : t('admin.orders.export')}
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onNewOrder}>
            <Icon name="plusCircle" size={14} />
            {t('admin.orders.newOrder')}
          </button>
        </div>
      </div>

      <div className="orders-toolbar-filters">
        <label className="orders-filter">
          <Icon name="layers3" size={13} className="orders-filter-icon" />
          <select
            className="form-control form-control-sm"
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value })}
            aria-label={t('admin.orders.statusLabel')}
          >
            <option value="">{t('admin.orders.allStatuses')}</option>
            <option value="In Review">{t('admin.status.inReview')}</option>
            <option value="In Production">{t('admin.status.inProduction')}</option>
            <option value="Quality Inspection">{t('admin.status.qualityInspection')}</option>
            <option value="Delivered">{t('admin.status.delivered')}</option>
            <option value="Cancelled">{t('admin.status.cancelled')}</option>
          </select>
        </label>

        <label className="orders-filter">
          <Icon name="technology" size={13} className="orders-filter-icon" />
          <select
            className="form-control form-control-sm"
            value={filters.technology}
            onChange={(e) => onFilterChange({ technology: e.target.value })}
            aria-label={t('admin.orders.technologyLabel')}
          >
            <option value="">{t('admin.orders.allTechnologies')}</option>
            {facets.technologies.map((tech) => (
              <option key={tech} value={tech}>{tech}</option>
            ))}
          </select>
        </label>

        <label className="orders-filter">
          <Icon name="cube" size={13} className="orders-filter-icon" />
          <select
            className="form-control form-control-sm"
            value={filters.material}
            onChange={(e) => onFilterChange({ material: e.target.value })}
            aria-label={t('admin.orders.materialLabel')}
          >
            <option value="">{t('admin.orders.allMaterials')}</option>
            {facets.materials.map((material) => (
              <option key={material} value={material}>{material}</option>
            ))}
          </select>
        </label>

        <div className="orders-filter orders-date-range">
          <Icon name="calendar" size={13} className="orders-filter-icon" />
          <input
            className="form-control form-control-sm form-control-date"
            type="date"
            value={filters.startDate}
            max={filters.endDate || undefined}
            onChange={(e) => onFilterChange({ startDate: e.target.value })}
            aria-label={t('admin.orders.fromDate')}
          />
          <span className="orders-date-sep">{t('admin.orders.toDate')}</span>
          <input
            className="form-control form-control-sm form-control-date"
            type="date"
            value={filters.endDate}
            min={filters.startDate || undefined}
            onChange={(e) => onFilterChange({ endDate: e.target.value })}
            aria-label={t('admin.orders.toDate')}
          />
        </div>

        {hasActiveFilters && (
          <button type="button" className="btn btn-sm btn-ghost orders-clear-filters" onClick={onClearFilters}>
            <Icon name="reset" size={13} />
            {t('admin.orders.clearFilters')}
          </button>
        )}
      </div>
    </div>
  );
};