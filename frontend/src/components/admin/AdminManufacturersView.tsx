import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';
import { StatCard } from './ui/StatCard';
import { AdminCard, AdminCardBody } from './ui/Card';
import { Button } from './ui/Button';
import { AdminSearchInput } from './ui/Fields';
import { Paginator } from './ui/Paginator';
import { LoadingRows, EmptyState, ErrorState } from './ui/States';
import { StatusBadge, StatusTone } from './ui/StatusBadge';
import { TechBadge } from './ui/TechBadge';

const LIMIT = 20;

type ManufacturerStats = {
  totalManufacturers: number;
  active: number;
  inactive: number;
  suspended: number;
  available: number;
  busy: number;
  offline: number;
};

const STATUS_TONES: Record<string, StatusTone> = {
  ACTIVE: 'delivered',
  INACTIVE: 'unknown',
  SUSPENDED: 'cancelled',
};

const AVAILABILITY_TONES: Record<string, StatusTone> = {
  AVAILABLE: 'delivered',
  BUSY: 'review',
  OFFLINE: 'unknown',
};

export const AdminManufacturersView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast, openAdminManufacturerDetail } = useStore();

  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ManufacturerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
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
      if (search) params.set('search', search);
      const res = await fetch(`/api/v1/admin/manufacturers?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(t('admin.lists.failedToLoad'));
      const data = await res.json();
      setManufacturers(data.data.manufacturers ?? []);
      setTotal(data.data.total ?? 0);
      if (data.data.stats) setStats(data.data.stats);
    } catch (err: any) {
      setError(err.message || String(err));
      showToast('Error', err.message || t('admin.lists.failedToLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, t, showToast]);

  useEffect(() => { void load(); }, [load]);

  const hasActiveFilters = Boolean(search);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setPage(0);
  };

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'ACTIVE': return t('admin.status.active');
      case 'INACTIVE': return t('admin.status.inactive');
      case 'DISABLED': return t('admin.status.disabled');
      case 'SUSPENDED': return t('admin.status.suspended');
      default: return status;
    }
  };

  const availabilityLabel = (availability: string): string => {
    switch (availability) {
      case 'AVAILABLE': return t('admin.status.available');
      case 'BUSY': return t('admin.status.busy');
      case 'OFFLINE': return t('admin.status.offline');
      default: return availability;
    }
  };

  const tableCols = 11;

  return (
    <AdminLayout title={t('admin.manufacturers.title')} subtitle={t('admin.manufacturers.subtitle', { total })}>
      <div className="admin-section">
        {stats && (
          <div className="admin-kpi-grid">
            <StatCard title={t('admin.manufacturers.kpiTotal')} value={stats.totalManufacturers} icon="network" tone="blue" />
            <StatCard title={t('admin.manufacturers.kpiActive')} value={stats.active} icon="check" tone="green" />
            <StatCard title={t('admin.manufacturers.kpiAvailable')} value={stats.available} icon="check" tone="cyan" />
            <StatCard title={t('admin.manufacturers.kpiBusy')} value={stats.busy} icon="clock" tone="amber" />
          </div>
        )}

        <div className="admin-toolbar">
          <AdminSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder={t('admin.manufacturers.searchPlaceholder')}
            ariaLabel={t('admin.lists.searchPlaceholder')}
            clearLabel={t('admin.lists.clearFilters')}
          />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" icon="reset" onClick={clearFilters}>
              {t('admin.lists.clearFilters')}
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="admin-count">{t('admin.lists.applied', { count: 1 })}</div>
        )}

        <AdminCard>
          <AdminCardBody flush>
            {error ? (
              <ErrorState text={error} onRetry={() => void load()} retryLabel={t('admin.lists.retry')} />
            ) : manufacturers.length === 0 && !loading ? (
              <EmptyState icon="network" text={t('admin.manufacturers.empty')} hint={hasActiveFilters ? t('admin.lists.applied', { count: 1 }) : undefined} />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('admin.manufacturers.company')}</th>
                      <th>{t('admin.manufacturers.contact')}</th>
                      <th>{t('admin.manufacturers.email')}</th>
                      <th>{t('admin.manufacturers.location')}</th>
                      <th>{t('admin.manufacturers.technologies')}</th>
                      <th className="col-numeric">{t('admin.manufacturers.capacity')}</th>
                      <th className="col-numeric">{t('admin.manufacturers.orders')}</th>
                      <th className="col-numeric">{t('admin.manufacturers.rating')}</th>
                      <th>{t('admin.manufacturers.status')}</th>
                      <th>{t('admin.manufacturers.availability')}</th>
                      <th>{t('admin.manufacturers.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <LoadingRows cols={tableCols} />
                    ) : (
                      manufacturers.map((m: any) => (
                        <tr key={m.id}>
                          <td className="mono-primary">{m.companyName}</td>
                          <td className="col-hide-md">{m.contactPerson}</td>
                          <td className="mono-muted col-hide-md">{m.email}</td>
                          <td>{m.location || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(m.supportedTechnologies || []).map((tech: string) => (
                                <TechBadge key={tech} label={tech} />
                              ))}
                            </div>
                          </td>
                          <td className="col-numeric">{m.capacity || '—'}</td>
                          <td className="col-numeric">{m.currentOrders || 0}/{m.completedOrders || 0}</td>
                          <td className="col-numeric">{m.performanceRating ? `${m.performanceRating}/5` : '—'}</td>
                          <td>
                            <StatusBadge
                              status={statusLabel(m.status)}
                              tone={STATUS_TONES[m.status] ?? 'unknown'}
                            />
                          </td>
                          <td>
                            <StatusBadge
                              status={availabilityLabel(m.availability)}
                              tone={AVAILABILITY_TONES[m.availability] ?? 'unknown'}
                            />
                          </td>
                          <td>
                            <Button variant="outline" size="sm" icon="eye" onClick={() => openAdminManufacturerDetail(m.id)}>
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