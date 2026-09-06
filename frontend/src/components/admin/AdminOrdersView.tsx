import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';
import { AppliedFilters, EMPTY_FILTERS, OrdersResponse, SortableColumn } from './orders/types';
import { OrderStatsPanel } from './orders/OrderStatsPanel';
import { OrdersStatusTabs } from './orders/OrdersStatusTabs';
import { OrdersToolbar } from './orders/OrdersToolbar';
import { OrdersTable } from './orders/OrdersTable';
import { OrdersPagination } from './orders/OrdersPagination';
import { CreateOrderModal } from './orders/CreateOrderModal';

const LIMIT = 20;

export const AdminOrdersView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast, openAdminOrderDetail, clearOrderSelection } = useStore();

  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortableColumn | ''>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [activeTab, setActiveTab] = useState('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [exporting, setExporting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const searchTimer = useRef<number | null>(null);

  const total = data?.total ?? 0;
  const stats = data?.stats ?? { totalOrders: 0, inReview: 0, inProduction: 0, qualityInspection: 0, completed: 0, cancelled: 0, trend: [] };
  const facets = data?.filters ?? { technologies: [], materials: [] };

  const hasActiveFilters = Boolean(
    searchInput ||
    filters.status ||
    filters.technology ||
    filters.material ||
    filters.startDate ||
    filters.endDate,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(page * LIMIT),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.status) params.set('status', filters.status);
      if (filters.technology) params.set('technology', filters.technology);
      if (filters.material) params.set('material', filters.material);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (sortBy) params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);

      const res = await fetch(`/api/v1/admin/orders?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load orders');
      const json = (await res.json()) as { data: OrdersResponse };
      setData(json.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filters, sortBy, sortDir]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 320);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [searchInput]);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    setPage(0);
  };

  const handleFilterChange = (patch: Partial<AppliedFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  };

  const clearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setFilters(EMPTY_FILTERS);
    setPage(0);
    setActiveTab('all');
    clearOrderSelection();
  };

  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey);
    const tab = tabKey === 'all' ? '' : (tabKey === 'inReview' ? 'In Review' : tabKey === 'inProduction' ? 'In Production' : tabKey === 'shipped' ? 'Delivered' : 'Completed');
    setFilters((current) => ({ ...current, status: tab }));
    setPage(0);
  };

  const handleSort = (column: SortableColumn) => {
    setPage(0);
    if (sortBy === column) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir(column === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    if (statusUpdating) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/status`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(t('admin.orders.statusUpdateFailed'));
      showToast(t('admin.orders.statusSuccessTitle'), t('admin.orders.statusSuccess', { status }), 'success');
      await load();
    } catch (err: any) {
      showToast('Error', err?.message || t('admin.orders.statusUpdateFailed'), 'error');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.status) params.set('status', filters.status);
      if (filters.technology) params.set('technology', filters.technology);
      if (filters.material) params.set('material', filters.material);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);

      const res = await fetch(`/api/v1/admin/orders/export?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(t('admin.orders.exportFailed'));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `cam-labs-admin-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast(t('admin.orders.exportSuccessTitle'), t('admin.orders.exportSuccess'), 'success');
    } catch (err: any) {
      showToast('Error', err?.message || t('admin.orders.exportFailed'), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminLayout
      title={t('admin.orders.title')}
      subtitle={t('admin.orders.subtitle', { total })}
    >
      <div className="admin-section">
        {stats && <OrderStatsPanel stats={stats} />}

        <OrdersStatusTabs activeTab={activeTab} onTabChange={handleTabChange} stats={stats} />

        <OrdersToolbar
          search={searchInput}
          onSearch={handleSearch}
          filters={filters}
          onFilterChange={handleFilterChange}
          facets={facets}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          exporting={exporting}
          onExport={handleExport}
          onNewOrder={() => setShowCreateModal(true)}
        />

        <OrdersTable
          orders={data?.orders ?? []}
          loading={loading}
          error={error}
          onRetry={load}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          onView={(order) => openAdminOrderDetail(order.id)}
          onStatusChange={(order, status) => void handleStatusChange(order.id, status)}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />

        <OrdersPagination
          total={total}
          page={page}
          limit={LIMIT}
          loading={loading}
          onPageChange={setPage}
        />

        {showCreateModal && (
          <CreateOrderModal
            onClose={() => setShowCreateModal(false)}
            onConverted={() => {
              setShowCreateModal(false);
              void load();
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
};