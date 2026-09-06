import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../context/StoreContext';
import { Icon } from '../../ui/Icon';
import { getAvatarInitial } from '../../ui/UserAvatar';
import { StatusBadge, statusToneOf } from '../ui/StatusBadge';
import { TechBadge } from '../ui/TechBadge';
import { ORDER_LIFECYCLE_STATUSES, OrderRow, SortableColumn } from './types';

interface ColumnDef {
  key: SortableColumn;
  labelKey: string;
  className?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: 'id', labelKey: 'admin.orders.col.id' },
  { key: 'customer', labelKey: 'admin.orders.col.customer' },
  { key: 'partName', labelKey: 'admin.orders.col.part' },
  { key: 'technology', labelKey: 'admin.orders.col.technology' },
  { key: 'material', labelKey: 'admin.orders.col.material', className: 'col-hide-md' },
  { key: 'quantity', labelKey: 'admin.orders.col.qty', className: 'col-numeric' },
  { key: 'total', labelKey: 'admin.orders.col.total', className: 'col-numeric' },
  { key: 'status', labelKey: 'admin.orders.col.status' },
  { key: 'manufacturer', labelKey: 'admin.orders.col.manufacturer', className: 'col-hide-md' },
  { key: 'createdAt', labelKey: 'admin.orders.col.date', className: 'col-date col-hide-sm' },
];

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

interface OrdersTableProps {
  orders: OrderRow[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  sortBy: SortableColumn | '';
  sortDir: 'asc' | 'desc';
  onSort: (column: SortableColumn) => void;
  onView: (order: OrderRow) => void;
  onStatusChange: (order: OrderRow, status: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  loading,
  error,
  onRetry,
  sortBy,
  sortDir,
  onSort,
  onView,
  onStatusChange,
  hasActiveFilters,
  onClearFilters,
}) => {
  const { t } = useTranslation();
  const { selectedOrderIds, toggleOrderSelection } = useStore();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openMenuId]);

  const toggleMenu = (id: string) => setOpenMenuId((current) => (current === id ? null : id));

  const allSelected = orders.length > 0 && orders.every((o) => selectedOrderIds?.includes(o.id));

  const handleToggleAll = () => {
    if (allSelected) {
      // deselect all visible
      orders.forEach((o) => {
        if (selectedOrderIds?.includes(o.id)) toggleOrderSelection(o.id);
      });
    } else {
      orders.forEach((o) => toggleOrderSelection(o.id));
    }
  };

  const handleToggleRow = (id: string) => toggleOrderSelection(id);

  return (
    <div className="admin-table-wrap">
      <table className="cam-table admin-table">
        <thead>
          <tr>
            <th className="col-select">
              <button
                type="button"
                className={`orders-checkbox ${allSelected ? 'is-checked' : ''}`}
                onClick={handleToggleAll}
                aria-label={t('admin.orders.selectAll')}
                title={t('admin.orders.selectAll')}
              >
                <span className="orders-checkbox-inner" />
              </button>
            </th>
            {COLUMNS.map((column) => {
              const active = sortBy === column.key;
              return (
                <th key={column.key} className={column.className}>
                  <button
                    type="button"
                    className={`admin-sort ${active ? 'is-active' : ''}`}
                    onClick={() => onSort(column.key)}
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    {t(column.labelKey)}
                    {active && (
                      <Icon name="chevronDown" size={12} className={sortDir === 'asc' ? 'admin-sort-asc' : ''} />
                    )}
                  </button>
                </th>
              );
            })}
            <th className="col-actions">{t('admin.orders.col.actions')}</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            Array.from({ length: 8 }).map((_, index) => (
              <tr key={index} className="admin-skeleton-row">
                <td><span className="skeleton-block admin-sk-id" /></td>
                <td><span className="skeleton-block admin-sk-name" /></td>
                <td><span className="skeleton-block admin-sk-part" /></td>
                <td><span className="skeleton-block admin-sk-badge" /></td>
                <td className="col-hide-md"><span className="skeleton-block admin-sk-mat" /></td>
                <td className="col-numeric"><span className="skeleton-block admin-sk-qty" /></td>
                <td className="col-numeric"><span className="skeleton-block admin-sk-total" /></td>
                <td><span className="skeleton-block admin-sk-badge" /></td>
                <td className="col-hide-md"><span className="skeleton-block admin-sk-mat" /></td>
                <td className="col-date col-hide-sm"><span className="skeleton-block admin-sk-date" /></td>
                <td className="col-actions"><span className="skeleton-block admin-sk-action" /></td>
              </tr>
            ))
          ) : error ? (
            <tr>
              <td colSpan={12}>
                <div className="error-state admin-error-state">
                  <span className="error-state-icon" aria-hidden="true"><Icon name="alert" size={22} /></span>
                  <span className="error-state-title">{t('admin.orders.loadError')}</span>
                  <button type="button" className="btn btn-sm btn-outline" onClick={onRetry}>
                    {t('admin.orders.retry')}
                  </button>
                </div>
              </td>
            </tr>
          ) : orders.length === 0 ? (
            <tr>
              <td colSpan={12}>
                <div className="empty-state admin-empty">
                  {hasActiveFilters ? (
                    <>
                      <span>{t('admin.orders.noMatch')}</span>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={onClearFilters}>
                        {t('admin.orders.clearFilters')}
                      </button>
                    </>
                  ) : (
                    <span>{t('admin.orders.empty')}</span>
                  )}
                </div>
              </td>
            </tr>
          ) : (
            orders.map((order) => {
              const isSelected = selectedOrderIds?.includes(order.id);
              const isOpen = openMenuId === order.id;
              return (
                <tr key={order.id} className={`admin-row ${isSelected ? 'is-selected' : ''}`}>
                  <td className="col-select">
                    <button
                      type="button"
                      className={`orders-checkbox ${isSelected ? 'is-checked' : ''}`}
                      onClick={() => handleToggleRow(order.id)}
                      aria-label={t('admin.orders.selectOrder')}
                      title={t('admin.orders.selectOrder')}
                    >
                      <span className="orders-checkbox-inner" />
                    </button>
                  </td>
                  <td>
                    <button type="button" className="admin-id" onClick={() => onView(order)} title={order.id}>
                      <span className="admin-id-primary">{order.id}</span>
                      <span className="admin-id-date">{formatDate(order.createdAt)}</span>
                    </button>
                  </td>
                  <td>
                    <div className="admin-customer">
                      <div className="admin-customer-name-wrap">
                        {order.user && (
                          <span className="user-avatar user-avatar-sm avatar-blue">{getAvatarInitial(order.user.name)}</span>
                        )}
                        <span className="admin-customer-name">{order.user?.name || '—'}</span>
                      </div>
                      {order.user?.company && <span className="admin-customer-company">{order.user.company}</span>}
                    </div>
                  </td>
                  <td>
                    <div className="admin-part" title={order.partName}>
                      <span className="admin-part-name">{order.partName}</span>
                    </div>
                  </td>
                  <td><TechBadge label={order.technology} title={order.technology} /></td>
                  <td className="col-hide-md"><span className="admin-muted">{order.material}</span></td>
                  <td className="col-numeric"><span className="admin-muted">{order.quantity}</span></td>
                  <td className="col-numeric"><span className="admin-total">{order.totalCost}</span></td>
                  <td><StatusBadge status={order.status} /></td>
                  <td className="col-hide-md"><span className="admin-muted">{order.manufacturer?.companyName || '—'}</span></td>
                  <td className="col-date col-hide-sm"><span className="admin-muted">{formatDate(order.createdAt)}</span></td>
                  <td className="col-actions">
                    <div className="admin-actions" ref={isOpen ? menuRef : null}>
                      <button
                        type="button"
                        className="cam-icon-btn"
                        onClick={() => onView(order)}
                        aria-label={t('admin.orders.viewOrder')}
                        title={t('admin.orders.viewOrder')}
                      >
                        <Icon name="eye" size={15} />
                      </button>
                      <button
                        type="button"
                        className={`cam-icon-btn admin-menu-btn ${isOpen ? 'is-open' : ''}`}
                        onClick={() => toggleMenu(order.id)}
                        aria-label={t('admin.orders.moreActions')}
                        aria-expanded={isOpen}
                        title={t('admin.orders.moreActions')}
                      >
                        <Icon name="menu" size={15} />
                      </button>
                      {isOpen && (
                        <div className="admin-menu" role="menu">
                          <button type="button" role="menuitem" onClick={() => { setOpenMenuId(null); onView(order); }}>
                            <Icon name="eye" size={14} />
                            {t('admin.orders.viewDetails')}
                          </button>
                          {ORDER_LIFECYCLE_STATUSES.filter((status) => status !== order.status).map((status) => (
                            <button
                              key={status}
                              type="button"
                              role="menuitem"
                              className="admin-menu-status"
                              onClick={() => { setOpenMenuId(null); onStatusChange(order, status); }}
                            >
                              <span className={`status-dot status-${statusToneOf(status)}`} />
                              {t('admin.orders.moveTo', { status })}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};