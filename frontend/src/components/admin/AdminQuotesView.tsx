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
import { StatusBadge, StatusTone, statusToneOf } from './ui/StatusBadge';
import { TechBadge } from './ui/TechBadge';

const LIMIT = 20;

type QuoteStats = {
  totalQuotes: number;
  approved: number;
  pending: number;
  revised: number;
  rejected: number;
  draft: number;
  converted: number;
};

const STATUS_OPTIONS = [
  { value: '', label: '' },
  { value: 'Ready for Approval', label: '' },
  { value: 'Approved', label: '' },
  { value: 'Rejected', label: '' },
  { value: 'Revised', label: '' },
  { value: 'Draft', label: '' },
];

const QUOTE_TONES: Record<string, StatusTone> = {
  'Ready for Approval': 'review',
  'Approved': 'delivered',
  'Rejected': 'cancelled',
  'Revised': 'review',
  'Draft': 'unknown',
  'Expired': 'unknown',
};

export const AdminQuotesView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast, openAdminQuoteDetail } = useStore();

  const [quotes, setQuotes] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<QuoteStats | null>(null);
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
      const res = await fetch(`/api/v1/admin/quotes?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(t('admin.lists.failedToLoad'));
      const data = await res.json();
      setQuotes(data.data.quotes ?? []);
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

  const quoteStatusLabel = (value: string): string => {
    switch (value) {
      case 'Ready for Approval': return t('admin.status.readyForApproval');
      case 'Approved': return t('admin.status.approved');
      case 'Rejected': return t('admin.status.rejected');
      case 'Revised': return t('admin.status.revised');
      case 'Draft': return t('admin.status.draft');
      case 'Expired': return t('admin.status.expired');
      default: return value;
    }
  };

  const statusOptions = STATUS_OPTIONS.map((o) => o.value === '' ? { value: '', label: t('admin.lists.allStatuses') } : { value: o.value, label: quoteStatusLabel(o.value) });

  const tableCols = 12;

  return (
    <AdminLayout title={t('admin.quotes.title')} subtitle={t('admin.quotes.subtitle', { total })}>
      <div className="admin-section">
        {stats && (
          <div className="admin-kpi-grid">
            <StatCard title={t('admin.quotes.kpiTotal')} value={stats.totalQuotes} icon="clipboard" tone="blue" />
            <StatCard title={t('admin.quotes.kpiApproved')} value={stats.approved} icon="check" tone="green" />
            <StatCard title={t('admin.quotes.kpiAwaiting')} value={stats.pending} icon="clock" tone="amber" />
            <StatCard title={t('admin.quotes.kpiConverted')} value={stats.converted} icon="layers" tone="purple" />
          </div>
        )}

        <div className="admin-toolbar">
          <AdminSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder={t('admin.quotes.searchPlaceholder')}
            ariaLabel={t('admin.lists.searchPlaceholder')}
            clearLabel={t('admin.lists.clearFilters')}
          />
          <AdminFilterSelect
            icon="filter"
            value={status}
            onChange={(value) => { setStatus(value); setPage(0); }}
            ariaLabel={t('admin.quotes.status')}
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
            ) : quotes.length === 0 && !loading ? (
              <EmptyState icon="clipboard" text={t('admin.quotes.empty')} hint={hasActiveFilters ? t('admin.lists.applied', { count: activeCount }) : undefined} />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('admin.quotes.quoteId')}</th>
                      <th>{t('admin.quotes.customer')}</th>
                      <th>{t('admin.quotes.partName')}</th>
                      <th>{t('admin.quotes.technology')}</th>
                      <th>{t('admin.quotes.material')}</th>
                      <th className="col-numeric">{t('admin.quotes.qty')}</th>
                      <th className="col-hide-md col-numeric">{t('admin.quotes.unitPrice')}</th>
                      <th className="col-numeric">{t('admin.quotes.total')}</th>
                      <th>{t('admin.quotes.status')}</th>
                      <th className="col-hide-md">{t('admin.quotes.date')}</th>
                      <th className="col-hide-md">{t('admin.quotes.validUntil')}</th>
                      <th>{t('admin.quotes.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <LoadingRows cols={tableCols} />
                    ) : (
                      quotes.map((q: any) => (
                        <tr key={q.id}>
                          <td className="mono-primary">{q.id}</td>
                          <td>{q.user?.name || '—'}</td>
                          <td>{q.partName}</td>
                          <td><TechBadge label={q.technology} /></td>
                          <td>{q.material}</td>
                          <td className="col-numeric">{q.quantity}</td>
                          <td className="col-hide-md col-numeric">{q.unitPrice}</td>
                          <td className="col-numeric">{q.totalPrice}</td>
                          <td>
                            <StatusBadge
                              status={quoteStatusLabel(q.status)}
                              tone={QUOTE_TONES[q.status] ?? statusToneOf(q.status)}
                            />
                          </td>
                          <td className="col-hide-md mono-muted">{new Date(q.createdAt).toLocaleDateString()}</td>
                          <td className="col-hide-md mono-muted">{q.validUntil || '—'}</td>
                          <td>
                            <Button variant="outline" size="sm" icon="eye" onClick={() => openAdminQuoteDetail(q.id)}>
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