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

type MaterialStats = {
  totalMaterials: number;
  active: number;
  inStock: number;
  outOfStock: number;
};

const TECH_OPTIONS = [
  { value: 'FDM', label: 'FDM' },
  { value: 'SLA', label: 'SLA' },
  { value: 'SLS', label: 'SLS' },
  { value: 'CNC_MILLING', label: 'CNC Milling' },
  { value: 'CNC_TURNING', label: 'CNC Turning' },
  { value: 'LASER_CUTTING', label: 'Laser Cutting' },
];

const AVAILABILITY_TONES: Record<string, StatusTone> = {
  IN_STOCK: 'delivered',
};

export const AdminMaterialsView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useStore();

  const [materials, setMaterials] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<MaterialStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [techFilter, setTechFilter] = useState('');
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
      if (techFilter) params.set('technology', techFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/v1/admin/materials?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(t('admin.lists.failedToLoad'));
      const data = await res.json();
      setMaterials(data.data.materials ?? []);
      setTotal(data.data.total ?? 0);
      if (data.data.stats) setStats(data.data.stats);
    } catch (err: any) {
      setError(err.message || String(err));
      showToast('Error', err.message || t('admin.lists.failedToLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, techFilter, search, t, showToast]);

  useEffect(() => { void load(); }, [load]);

  const hasActiveFilters = Boolean(techFilter || search);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setTechFilter('');
    setPage(0);
  };

  const activeCount = (techFilter ? 1 : 0) + (search ? 1 : 0);

  const techOptions = [
    { value: '', label: t('admin.filters.allTechnologies') },
    ...TECH_OPTIONS,
  ];

  const tableCols = 10;

  return (
    <AdminLayout title={t('admin.materials.title')} subtitle={t('admin.materials.subtitle', { total })}>
      <div className="admin-section">
        {stats && (
          <div className="admin-kpi-grid">
            <StatCard title={t('admin.materials.kpiTotal')} value={stats.totalMaterials} icon="network" tone="blue" />
            <StatCard title={t('admin.materials.kpiActive')} value={stats.active} icon="check" tone="green" />
            <StatCard title={t('admin.materials.kpiInStock')} value={stats.inStock} icon="cube" tone="cyan" />
          </div>
        )}

        <div className="admin-toolbar">
          <AdminSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder={t('admin.materials.searchPlaceholder')}
            ariaLabel={t('admin.lists.searchPlaceholder')}
            clearLabel={t('admin.lists.clearFilters')}
          />
          <AdminFilterSelect
            icon="filter"
            value={techFilter}
            onChange={(value) => { setTechFilter(value); setPage(0); }}
            ariaLabel={t('admin.filters.allTechnologies')}
            options={techOptions}
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
            ) : materials.length === 0 && !loading ? (
              <EmptyState icon="cube" text="No materials found" hint={hasActiveFilters ? t('admin.lists.applied', { count: activeCount }) : undefined} />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Technology</th>
                      <th>Category</th>
                      <th className="col-numeric">Density</th>
                      <th className="col-numeric">Tensile</th>
                      <th className="col-numeric">HDT</th>
                      <th className="col-numeric">Price/Unit</th>
                      <th className="col-hide-md">Lead Time</th>
                      <th>Active</th>
                      <th>Availability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <LoadingRows cols={tableCols} />
                    ) : (
                      materials.map((m: any) => (
                        <tr key={m.id}>
                          <td className="mono-primary">{m.name}</td>
                          <td>
                            <TechBadge label={m.technology} />
                          </td>
                          <td>{m.category}</td>
                          <td className="col-numeric">{m.density} g/cm³</td>
                          <td className="col-numeric">{m.tensileStrength} MPa</td>
                          <td className="col-numeric">{m.hdt}°C</td>
                          <td className="col-numeric">{m.pricePerUnit ? `${m.pricePerUnit} ${m.priceUnit || ''}` : '—'}</td>
                          <td className="col-hide-md">{m.leadTime}</td>
                          <td>
                            <StatusBadge
                              status={m.isActive ? t('admin.status.active') : t('admin.status.inactive')}
                              tone={m.isActive ? 'delivered' : 'unknown'}
                            />
                          </td>
                          <td>
                            <StatusBadge
                              status={m.availability}
                              tone={AVAILABILITY_TONES[m.availability] ?? 'unknown'}
                            />
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