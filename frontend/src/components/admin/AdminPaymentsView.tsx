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

type PaymentStats = {
  totalPayments: number;
  totalRevenue: number;
  paid: number;
  pending: number;
  failed: number;
  refunded: number;
};

const STATUS_OPTIONS = [
  { value: '', label: '' },
  { value: 'PAID', label: '' },
  { value: 'PENDING', label: '' },
  { value: 'FAILED', label: '' },
  { value: 'REFUNDED', label: '' },
  { value: 'PARTIALLY_REFUNDED', label: '' },
];

const PAYMENT_TONES: Record<string, StatusTone> = {
  PAID: 'delivered',
  PENDING: 'review',
  FAILED: 'cancelled',
  REFUNDED: 'inspection',
  PARTIALLY_REFUNDED: 'inspection',
};

export const AdminPaymentsView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useStore();

  const [payments, setPayments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<PaymentStats | null>(null);
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
      const res = await fetch(`/api/v1/admin/payments?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(t('admin.lists.failedToLoad'));
      const data = await res.json();
      setPayments(data.data.payments ?? []);
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

  const statusLabel = (value: string): string => {
    switch (value) {
      case 'PAID': return t('admin.status.paid');
      case 'PENDING': return t('admin.status.pending');
      case 'FAILED': return t('admin.status.failed');
      case 'REFUNDED': return t('admin.status.refunded');
      case 'PARTIALLY_REFUNDED': return t('admin.status.partiallyRefunded');
      default: return value;
    }
  };

  const formatAmount = (amount: string | number): string =>
    Number(amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const statusOptions = STATUS_OPTIONS.map((o) =>
    o.value === ''
      ? { value: '', label: t('admin.lists.allStatuses') }
      : { value: o.value, label: statusLabel(o.value) },
  );

  const tableCols = 9;

  return (
    <AdminLayout title={t('admin.payments.title')} subtitle={t('admin.payments.subtitle', { total })}>
      <div className="admin-section">
        {stats && (
          <div className="admin-kpi-grid">
            <StatCard title={t('admin.payments.kpiTotalRevenue')} value={stats.totalRevenue.toLocaleString()} icon="database" tone="blue" />
            <StatCard title={t('admin.payments.kpiTotalPayments')} value={stats.totalPayments} icon="layers" tone="cyan" />
            <StatCard title={t('admin.payments.kpiPaid')} value={stats.paid} icon="check" tone="green" />
            <StatCard title={t('admin.payments.kpiPending')} value={stats.pending} icon="clock" tone="amber" />
          </div>
        )}

        <div className="admin-toolbar">
          <AdminSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder={t('admin.payments.searchPlaceholder')}
            ariaLabel={t('admin.lists.searchPlaceholder')}
            clearLabel={t('admin.lists.clearFilters')}
          />
          <AdminFilterSelect
            icon="filter"
            value={status}
            onChange={(value) => { setStatus(value); setPage(0); }}
            ariaLabel={t('admin.payments.status')}
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
            ) : payments.length === 0 && !loading ? (
              <EmptyState icon="database" text={t('admin.payments.empty')} hint={hasActiveFilters ? t('admin.lists.applied', { count: activeCount }) : undefined} />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('admin.payments.paymentId')}</th>
                      <th>{t('admin.payments.order')}</th>
                      <th>{t('admin.payments.customer')}</th>
                      <th className="col-numeric">{t('admin.payments.amount')}</th>
                      <th>{t('admin.payments.currency')}</th>
                      <th>{t('admin.payments.method')}</th>
                      <th>{t('admin.payments.status')}</th>
                      <th className="col-hide-md">{t('admin.payments.transactionId')}</th>
                      <th className="col-hide-md">{t('admin.payments.date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <LoadingRows cols={tableCols} />
                    ) : (
                      payments.map((p: any) => (
                        <tr key={p.id}>
                          <td className="mono-primary">{p.id.slice(0, 8)}</td>
                          <td>{p.order?.id || '—'}</td>
                          <td>{p.user?.name || '—'}</td>
                          <td className="col-numeric"><strong>{formatAmount(p.amount)}</strong></td>
                          <td>{p.currency || '—'}</td>
                          <td className="mono-muted">{p.paymentMethod || '—'}</td>
                          <td>
                            <StatusBadge
                              status={statusLabel(p.paymentStatus)}
                              tone={PAYMENT_TONES[p.paymentStatus] ?? 'unknown'}
                            />
                          </td>
                          <td className="col-hide-md mono-muted">{p.transactionId || '—'}</td>
                          <td className="col-hide-md mono-muted">{new Date(p.createdAt).toLocaleDateString()}</td>
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