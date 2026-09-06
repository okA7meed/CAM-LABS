import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';
import { StatCard } from './ui/StatCard';
import { AdminCard, AdminCardBody } from './ui/Card';
import { Button } from './ui/Button';
import { AdminSearchInput, AdminFilterSelect } from './ui/Fields';
import { Paginator } from './ui/Paginator';
import { LoadingRows, EmptyState, ErrorState } from './ui/States';
import { StatusBadge, StatusTone } from './ui/StatusBadge';
import { TechBadge } from './ui/TechBadge';

const LIMIT = 20;

type RequestStats = {
  totalRequests: number;
  pending: number;
  accepted: number;
  rejected: number;
  inProgress: number;
  completed: number;
  cancelled: number;
};

const STATUS_OPTIONS = [
  { value: 'PENDING', label: '' },
  { value: 'ACCEPTED', label: '' },
  { value: 'IN_PROGRESS', label: '' },
  { value: 'COMPLETED', label: '' },
  { value: 'CANCELLED', label: '' },
];

const STATUS_TONES: Record<string, StatusTone> = {
  PENDING: 'review',
  ACCEPTED: 'review',
  REJECTED: 'cancelled',
  IN_PROGRESS: 'review',
  COMPLETED: 'delivered',
  CANCELLED: 'cancelled',
};

export const AdminManufacturingRequestsView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast, openAdminManufacturingRequestDetail } = useStore();

  const [requests, setRequests] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<RequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput.trim()), 320);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(page * LIMIT) });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/v1/admin/manufacturing-requests?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(t('admin.lists.failedToLoad'));
      const data = await res.json();
      setRequests(data.data.requests ?? []);
      setTotal(data.data.total ?? 0);
      if (data.data.stats) setStats(data.data.stats);
    } catch (err: any) {
      setError(err.message || String(err));
      showToast('Error', err.message || t('admin.lists.failedToLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, t, showToast]);

  useEffect(() => { void load(); }, [load]);

  const hasActiveFilters = Boolean(statusFilter || search);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
    setPage(0);
  };

  const activeCount = (statusFilter ? 1 : 0) + (search ? 1 : 0);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/v1/admin/manufacturing-requests/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('Failed to update');
      showToast('Updated', `Request status changed to ${status}`, 'success');
      void load();
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    }
  };

  const requestStatusLabel = (status: string): string => {
    switch (status) {
      case 'PENDING': return t('admin.status.pending');
      case 'ACCEPTED': return t('admin.status.accepted');
      case 'REJECTED': return t('admin.status.rejected');
      case 'IN_PROGRESS': return t('admin.status.inProgress');
      case 'COMPLETED': return t('admin.status.completed');
      case 'CANCELLED': return t('admin.status.cancelled');
      default: return status;
    }
  };

  const statusOptions = STATUS_OPTIONS.map((o) => ({ value: o.value, label: requestStatusLabel(o.value) }));
  statusOptions.unshift({ value: '', label: t('admin.lists.allStatuses') });

  const tableCols = 9;

  return (
    <AdminLayout title={t('admin.manufacturingRequests.title')} subtitle={t('admin.manufacturingRequests.subtitle', { total })}>
      <div className="admin-section">
        {stats && (
          <div className="admin-kpi-grid">
            <StatCard title={t('admin.manufacturingRequests.kpiTotal')} value={stats.totalRequests} icon="network" tone="blue" />
            <StatCard title={t('admin.manufacturingRequests.kpiPending')} value={stats.pending} icon="clock" tone="amber" />
            <StatCard title={t('admin.manufacturingRequests.kpiInProgress')} value={stats.inProgress} icon="cpu" tone="cyan" />
            <StatCard title={t('admin.manufacturingRequests.kpiCompleted')} value={stats.completed} icon="check" tone="green" />
          </div>
        )}

        <div className="admin-toolbar">
          <AdminSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder={t('admin.manufacturingRequests.searchPlaceholder')}
            ariaLabel={t('admin.lists.searchPlaceholder')}
            clearLabel={t('admin.lists.clearFilters')}
          />
          <AdminFilterSelect
            icon="filter"
            value={statusFilter}
            onChange={(value) => { setStatusFilter(value); setPage(0); }}
            ariaLabel={t('admin.lists.allStatuses')}
            options={statusOptions}
          />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" icon="reset" onClick={clearFilters}>
              {t('admin.lists.clearFilters')}
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="admin-count">{t('admin.lists.applied', { count: activeCount })}</div>
        )}

        <AdminCard>
          <AdminCardBody flush>
            {error ? (
              <ErrorState text={error} onRetry={() => void load()} retryLabel={t('admin.lists.retry')} />
            ) : requests.length === 0 && !loading ? (
              <EmptyState icon="clipboard" text="No requests found" hint={hasActiveFilters ? t('admin.lists.applied', { count: activeCount }) : undefined} />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('admin.manufacturingRequests.requestId')}</th>
                      <th>{t('admin.manufacturingRequests.order')}</th>
                      <th>{t('admin.manufacturingRequests.manufacturer')}</th>
                      <th>{t('admin.manufacturingRequests.technology')}</th>
                      <th>{t('admin.manufacturingRequests.material')}</th>
                      <th className="col-numeric">{t('admin.manufacturingRequests.quantity')}</th>
                      <th>{t('admin.manufacturingRequests.status')}</th>
                      <th className="col-hide-md">{t('admin.manufacturingRequests.created')}</th>
                      <th>{t('admin.manufacturingRequests.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <LoadingRows cols={tableCols} />
                    ) : (
                      requests.map((r: any) => (
                        <tr key={r.id}>
                          <td className="mono-primary">{r.id.slice(0, 8)}</td>
                          <td>{r.order?.id || '—'}</td>
                          <td>{r.manufacturer?.companyName || '—'}</td>
                          <td>
                            <TechBadge label={r.technology} />
                          </td>
                          <td>{r.material}</td>
                          <td className="col-numeric">{r.quantity}</td>
                          <td>
                            <StatusBadge
                              status={requestStatusLabel(r.status)}
                              tone={STATUS_TONES[r.status] ?? 'unknown'}
                            />
                          </td>
                          <td className="col-hide-md mono-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {r.status === 'PENDING' && (
                                <>
                                  <Button variant="outline" size="sm" onClick={() => void updateStatus(r.id, 'ACCEPTED')}>
                                    Accept
                                  </Button>
                                  <Button variant="danger" size="sm" onClick={() => void updateStatus(r.id, 'CANCELLED')}>
                                    Cancel
                                  </Button>
                                </>
                              )}
                              {r.status === 'ACCEPTED' && (
                                <Button variant="outline" size="sm" onClick={() => void updateStatus(r.id, 'IN_PROGRESS')}>
                                  Start
                                </Button>
                              )}
                              {r.status === 'IN_PROGRESS' && (
                                <Button variant="outline" size="sm" onClick={() => void updateStatus(r.id, 'COMPLETED')}>
                                  Complete
                                </Button>
                              )}
                              <Button variant="outline" size="sm" icon="eye" onClick={() => openAdminManufacturingRequestDetail(r.id)}>
                                {t('admin.lists.view')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </AdminCardBody>
        </AdminCard>

        {total > LIMIT && (
          <Paginator total={total} page={page} limit={LIMIT} loading={loading} onPageChange={setPage} />
        )}
      </div>
    </AdminLayout>
  );
};