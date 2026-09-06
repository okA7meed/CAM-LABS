import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';
import { StatCard } from './ui/StatCard';
import { AdminCard, AdminCardBody } from './ui/Card';
import { Button } from './ui/Button';
import { AdminSearchInput, AdminFilterSelect, AdminDateRangeFilter } from './ui/Fields';
import { Paginator } from './ui/Paginator';
import { LoadingRows, EmptyState, ErrorState } from './ui/States';

const LIMIT = 30;

type LogStats = {
  totalLogs: number;
};

export const AdminAuditLogsView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useStore();

  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [userId, setUserId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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
      if (userId) params.set('userId', userId);
      if (entityType) params.set('entityType', entityType);
      if (action) params.set('action', action);
      if (search) params.set('search', search);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/v1/admin/audit-logs?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(t('admin.lists.failedToLoad'));
      const data = await res.json();
      setLogs(data.data.logs ?? []);
      setTotal(data.data.total ?? 0);
      if (data.data.stats) setStats(data.data.stats);
    } catch (err: any) {
      setError(err.message || String(err));
      showToast('Error', err.message || t('admin.lists.failedToLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, userId, entityType, action, search, startDate, endDate, t, showToast]);

  useEffect(() => { void load(); }, [load]);

  const hasActiveFilters = Boolean(userId || entityType || action || search || startDate || endDate);

  const activeCount =
    (userId ? 1 : 0) + (entityType ? 1 : 0) + (action ? 1 : 0) + (search ? 1 : 0) + (startDate ? 1 : 0) + (endDate ? 1 : 0);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setUserId('');
    setEntityType('');
    setAction('');
    setStartDate('');
    setEndDate('');
    setPage(0);
  };

  const adminOptions = [
    { value: '', label: t('admin.auditLogs.allAdmins') },
    ...Array.from(new Map(
      logs.map((l: any) => [l.user?.id, l.user?.name ?? l.user?.email ?? '']).filter(([id, name]) => id && name) as [string, string][],
    ).entries()).map(([id, name]) => ({ value: id, label: name })),
  ];

  const entityOptions = [
    { value: '', label: t('admin.auditLogs.allEntities') },
    ...Array.from(new Set(logs.map((l: any) => l.entityType).filter(Boolean)))
      .map((value) => ({ value: value as string, label: value as string })),
  ];

  const actionOptions = [
    { value: '', label: t('admin.auditLogs.allActions') },
    ...Array.from(new Set(logs.map((l: any) => l.action).filter(Boolean)))
      .map((value) => ({ value: value as string, label: value as string })),
  ];

  const tableCols = 6;

  return (
    <AdminLayout title={t('admin.auditLogs.title')} subtitle={t('admin.auditLogs.subtitle', { total })}>
      <div className="admin-section">
        {stats && (
          <div className="admin-kpi-grid">
            <StatCard title={t('admin.auditLogs.kpiTotalLogs')} value={stats.totalLogs} icon="review" tone="purple" />
          </div>
        )}

        <div className="admin-toolbar">
          <AdminSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder={t('admin.auditLogs.searchPlaceholder')}
            ariaLabel={t('admin.lists.searchPlaceholder')}
            clearLabel={t('admin.lists.clearFilters')}
          />
          <AdminFilterSelect
            icon="filter"
            value={action}
            onChange={(value) => { setAction(value); setPage(0); }}
            ariaLabel={t('admin.auditLogs.action')}
            options={actionOptions}
          />
          <AdminFilterSelect
            icon="filter"
            value={entityType}
            onChange={(value) => { setEntityType(value); setPage(0); }}
            ariaLabel={t('admin.auditLogs.entity')}
            options={entityOptions}
          />
          <AdminFilterSelect
            icon="filter"
            value={userId}
            onChange={(value) => { setUserId(value); setPage(0); }}
            ariaLabel={t('admin.auditLogs.admin')}
            options={adminOptions}
          />
          <AdminDateRangeFilter
            fromLabel={t('admin.lists.fromDate')}
            toLabel={t('admin.lists.toDate')}
            startDate={startDate}
            endDate={endDate}
            onChange={(patch) => { setStartDate(patch.startDate); setEndDate(patch.endDate); setPage(0); }}
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
            ) : logs.length === 0 && !loading ? (
              <EmptyState icon="review" text={t('admin.auditLogs.empty')} hint={hasActiveFilters ? t('admin.lists.applied', { count: activeCount }) : undefined} />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('admin.auditLogs.admin')}</th>
                      <th>{t('admin.auditLogs.action')}</th>
                      <th>{t('admin.auditLogs.entity')}</th>
                      <th>{t('admin.auditLogs.entityId')}</th>
                      <th>{t('admin.auditLogs.details')}</th>
                      <th>{t('admin.auditLogs.date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <LoadingRows cols={tableCols} />
                    ) : (
                      logs.map((l: any) => (
                        <tr key={l.id}>
                          <td className="mono-muted">{l.user?.name || l.user?.email || '—'}</td>
                          <td><span className="badge badge-neutral">{l.action}</span></td>
                          <td>{l.entityType}</td>
                          <td className="mono-muted">{l.entityId ? l.entityId.slice(0, 12) : '—'}</td>
                          <td className="mono-muted" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {l.newValue ? JSON.stringify(l.newValue).slice(0, 60) : '—'}
                          </td>
                          <td className="mono-muted">{new Date(l.createdAt).toLocaleString()}</td>
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