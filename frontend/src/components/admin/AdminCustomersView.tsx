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

const LIMIT = 20;

type CustomerStats = {
  totalCustomers: number;
  active: number;
  disabled: number;
  suspended: number;
  newRecent: number;
  withOrders: number;
};

const STATUS_OPTIONS = [
  { value: '', label: '' },
  { value: 'ACTIVE', label: '' },
  { value: 'DISABLED', label: '' },
  { value: 'SUSPENDED', label: '' },
];

const ACCOUNT_TONES: Record<string, StatusTone> = {
  ACTIVE: 'delivered',
  DISABLED: 'unknown',
  SUSPENDED: 'cancelled',
};

export const AdminCustomersView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast, openAdminCustomerDetail } = useStore();

  const [customers, setCustomers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');
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
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      const res = await fetch(`/api/v1/admin/customers?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(t('admin.lists.failedToLoad'));
      const data = await res.json();
      setCustomers(data.data.customers ?? []);
      setTotal(data.data.total ?? 0);
      if (data.data.stats) setStats(data.data.stats);
    } catch (err: any) {
      setError(err.message || String(err));
      showToast('Error', err.message || t('admin.lists.failedToLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, status, search, t, showToast]);

  useEffect(() => { void load(); }, [load]);

  const hasActiveFilters = Boolean(status || search);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setPage(0);
  };

  const activeCount = (status ? 1 : 0) + (search ? 1 : 0);

  const accountStatusLabel = (value: string): string => {
    switch (value) {
      case 'ACTIVE': return t('admin.status.active');
      case 'DISABLED': return t('admin.status.disabled');
      case 'SUSPENDED': return t('admin.status.suspended');
      default: return value;
    }
  };

  const roleLabel = (role: string): string => {
    if (/superadmin/i.test(role)) return role;
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  const statusOptions = STATUS_OPTIONS.map((o) => o.value === '' ? { value: '', label: t('admin.lists.allStatuses') } : { value: o.value, label: accountStatusLabel(o.value) });

  const tableCols = 10;

  return (
    <AdminLayout title={t('admin.customers.title')} subtitle={t('admin.customers.subtitle', { total })}>
      <div className="admin-section">
        {stats && (
          <div className="admin-kpi-grid">
            <StatCard title={t('admin.customers.kpiTotal')} value={stats.totalCustomers} icon="network" tone="blue" />
            <StatCard title={t('admin.customers.kpiActive')} value={stats.active} icon="check" tone="green" />
            <StatCard title={t('admin.customers.kpiNew')} value={stats.newRecent} icon="plusCircle" tone="cyan" />
            <StatCard title={t('admin.customers.kpiWithOrders')} value={stats.withOrders} icon="cube" tone="purple" />
          </div>
        )}

        <div className="admin-toolbar">
          <AdminSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder={t('admin.customers.searchPlaceholder')}
            ariaLabel={t('admin.lists.searchPlaceholder')}
            clearLabel={t('admin.lists.clearFilters')}
          />
          <AdminFilterSelect
            icon="filter"
            value={status}
            onChange={(value) => { setStatus(value); setPage(0); }}
            ariaLabel={t('admin.customers.status')}
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
            ) : customers.length === 0 && !loading ? (
              <EmptyState icon="network" text={t('admin.customers.empty')} hint={hasActiveFilters ? t('admin.lists.applied', { count: activeCount }) : undefined} />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('admin.customers.name')}</th>
                      <th>{t('admin.customers.email')}</th>
                      <th>{t('admin.customers.company')}</th>
                      <th>{t('admin.customers.role')}</th>
                      <th>{t('admin.customers.status')}</th>
                      <th className="col-numeric">{t('admin.customers.orders')}</th>
                      <th className="col-numeric">{t('admin.customers.quotes')}</th>
                      <th className="col-numeric">{t('admin.customers.cadFiles')}</th>
                      <th className="col-hide-md">{t('admin.customers.joined')}</th>
                      <th>{t('admin.customers.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <LoadingRows cols={tableCols} />
                    ) : (
                      customers.map((c: any) => (
                        <tr key={c.id}>
                          <td className="mono-primary">{c.name}</td>
                          <td className="mono-muted">{c.email}</td>
                          <td>{c.company || '—'}</td>
                          <td><span className="badge badge-neutral">{roleLabel(c.role)}</span></td>
                          <td>
                            <StatusBadge
                              status={accountStatusLabel(c.accountStatus)}
                              tone={ACCOUNT_TONES[c.accountStatus] ?? 'unknown'}
                            />
                          </td>
                          <td className="col-numeric">{c._count?.orders ?? 0}</td>
                          <td className="col-numeric">{c._count?.quotes ?? 0}</td>
                          <td className="col-numeric">{c._count?.cadFiles ?? 0}</td>
                          <td className="col-hide-md mono-muted">{new Date(c.createdAt).toLocaleDateString()}</td>
                          <td>
                            <Button variant="outline" size="sm" icon="eye" onClick={() => openAdminCustomerDetail(c.id)}>
                              {t('admin.lists.view')}
                            </Button>
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