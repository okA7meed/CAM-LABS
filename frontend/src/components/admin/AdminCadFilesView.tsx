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

const LIMIT = 20;

type CadFileStats = {
  totalFiles: number;
  verified: number;
  analyzing: number;
  flagged: number;
  quarantined: number;
  failed: number;
};

const STATUS_OPTIONS = [
  { value: '', label: '' },
  { value: 'Verified CAD', label: '' },
  { value: 'Analyzing', label: '' },
  { value: 'DFM Flagged', label: '' },
  { value: 'Quarantined', label: '' },
  { value: 'Processing Failed', label: '' },
];

const FILE_TONES: Record<string, StatusTone> = {
  'Verified CAD': 'delivered',
  'Analyzing': 'review',
  'DFM Flagged': 'inspection',
  'Quarantined': 'cancelled',
  'Processing Failed': 'cancelled',
};

export const AdminCadFilesView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast, openAdminCadFileDetail } = useStore();

  const [files, setFiles] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<CadFileStats | null>(null);
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
      const res = await fetch(`/api/v1/admin/cad-files?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(t('admin.lists.failedToLoad'));
      const data = await res.json();
      setFiles(data.data.cadFiles ?? []);
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

  const cadFileStatusLabel = (value: string): string => {
    switch (value) {
      case 'Verified CAD': return t('admin.status.verifiedCad');
      case 'Analyzing': return t('admin.status.analyzing');
      case 'DFM Flagged': return t('admin.status.dfmFlagged');
      case 'Quarantined': return t('admin.status.quarantined');
      case 'Processing Failed': return t('admin.status.processingFailed');
      default: return value;
    }
  };

  const statusOptions = STATUS_OPTIONS.map((o) => o.value === '' ? { value: '', label: t('admin.lists.allStatuses') } : { value: o.value, label: cadFileStatusLabel(o.value) });

  const tableCols = 10;

  return (
    <AdminLayout title={t('admin.cadFiles.title')} subtitle={t('admin.cadFiles.subtitle', { total })}>
      <div className="admin-section">
        {stats && (
          <div className="admin-kpi-grid">
            <StatCard title={t('admin.cadFiles.kpiTotal')} value={stats.totalFiles} icon="cube" tone="blue" />
            <StatCard title={t('admin.cadFiles.kpiVerified')} value={stats.verified} icon="shieldCheck" tone="green" />
            <StatCard title={t('admin.cadFiles.kpiAnalyzing')} value={stats.analyzing} icon="search" tone="amber" />
            <StatCard title={t('admin.cadFiles.kpiQuarantined')} value={stats.quarantined} icon="alert" tone="magenta" />
          </div>
        )}

        <div className="admin-toolbar">
          <AdminSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder={t('admin.cadFiles.searchPlaceholder')}
            ariaLabel={t('admin.lists.searchPlaceholder')}
            clearLabel={t('admin.lists.clearFilters')}
          />
          <AdminFilterSelect
            icon="filter"
            value={status}
            onChange={(value) => { setStatus(value); setPage(0); }}
            ariaLabel={t('admin.cadFiles.status')}
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
            ) : files.length === 0 && !loading ? (
              <EmptyState icon="file" text={t('admin.cadFiles.empty')} hint={hasActiveFilters ? t('admin.lists.applied', { count: activeCount }) : undefined} />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('admin.cadFiles.fileName')}</th>
                      <th>{t('admin.cadFiles.customer')}</th>
                      <th>{t('admin.cadFiles.format')}</th>
                      <th className="col-numeric">{t('admin.cadFiles.size')}</th>
                      <th>{t('admin.cadFiles.status')}</th>
                      <th>{t('admin.cadFiles.volume')}</th>
                      <th>{t('admin.cadFiles.dimensions')}</th>
                      <th className="col-numeric">{t('admin.cadFiles.orders')}</th>
                      <th className="col-hide-md">{t('admin.cadFiles.uploaded')}</th>
                      <th>{t('admin.cadFiles.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <LoadingRows cols={tableCols} />
                    ) : (
                      files.map((f: any) => (
                        <tr key={f.id}>
                          <td className="mono-primary">{f.name}</td>
                          <td>{f.user?.name || '—'}</td>
                          <td><span className="badge badge-neutral">{f.format}</span></td>
                          <td className="col-numeric">{f.size}</td>
                          <td>
                            <StatusBadge
                              status={cadFileStatusLabel(f.status)}
                              tone={FILE_TONES[f.status] ?? statusToneOf(f.status)}
                            />
                          </td>
                          <td>{f.volume || '—'}</td>
                          <td>{f.dimensions || '—'}</td>
                          <td className="col-numeric">{f._count?.orders ?? 0}</td>
                          <td className="col-hide-md mono-muted">{new Date(f.createdAt).toLocaleDateString()}</td>
                          <td>
                            <Button variant="outline" size="sm" icon="eye" onClick={() => openAdminCadFileDetail(f.id)}>
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