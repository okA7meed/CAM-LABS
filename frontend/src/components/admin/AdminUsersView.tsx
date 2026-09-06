import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';
import { StatCard } from './ui/StatCard';
import { AdminCard, AdminCardBody } from './ui/Card';
import { Button } from './ui/Button';
import { AdminSearchInput, AdminFilterSelect } from './ui/Fields';
import { LoadingRows, EmptyState, ErrorState } from './ui/States';
import { StatusBadge, StatusTone } from './ui/StatusBadge';

const ACCOUNT_TONES: Record<string, StatusTone> = {
  ACTIVE: 'delivered',
  DISABLED: 'unknown',
  SUSPENDED: 'cancelled',
};

export const AdminUsersView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/users', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(t('admin.lists.failedToLoad'));
      const data = await res.json();
      setUsers(data.data || []);
    } catch (err: any) {
      setError(err.message || String(err));
      showToast('Error', err.message || t('admin.lists.failedToLoad'), 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const totalAdmins = users.length;
  const superAdmins = users.filter((u: any) => /superadmin/i.test(u.role ?? '')).length;
  const admins = totalAdmins - superAdmins;

  const search = searchInput.trim().toLowerCase();
  const filtered = users.filter((u: any) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search) {
      const q = search;
      return (u.name?.toLowerCase() ?? '').includes(q) || (u.email?.toLowerCase() ?? '').includes(q);
    }
    return true;
  });

  const hasActiveFilters = Boolean(roleFilter || search);
  const activeCount = (roleFilter ? 1 : 0) + (search ? 1 : 0);

  const clearFilters = () => {
    setSearchInput('');
    setRoleFilter('');
  };

  const roleOptions = [{ value: '', label: t('admin.users.allRoles') }, ...Array.from(new Set(users.map((u: any) => u.role).filter(Boolean)))
    .map((role) => ({ value: role as string, label: role as string }))];

  const accountStatusLabel = (status: string): string => {
    switch (status) {
      case 'ACTIVE': return t('admin.status.active');
      case 'DISABLED': return t('admin.status.disabled');
      case 'SUSPENDED': return t('admin.status.suspended');
      default: return status;
    }
  };

  const tableCols = 7;

  return (
    <AdminLayout title={t('admin.users.title')} subtitle={t('admin.users.subtitle', { total: totalAdmins })}>
      <div className="admin-section">
        <div className="admin-kpi-grid">
          <StatCard title={t('admin.users.kpiTotal')} value={totalAdmins} icon="network" tone="blue" />
          <StatCard title={t('admin.users.kpiSuperAdmins')} value={superAdmins} icon="shieldCheck" tone="purple" />
          <StatCard title={t('admin.users.kpiAdmins')} value={admins} icon="gear" tone="cyan" />
        </div>

        <div className="admin-toolbar">
          <AdminSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder={t('admin.users.searchPlaceholder')}
            ariaLabel={t('admin.lists.searchPlaceholder')}
            clearLabel={t('admin.lists.clearFilters')}
          />
          <AdminFilterSelect
            icon="filter"
            value={roleFilter}
            onChange={setRoleFilter}
            ariaLabel={t('admin.users.role')}
            options={roleOptions}
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
            ) : filtered.length === 0 && !loading ? (
              <EmptyState icon="network" text={t('admin.users.empty')} hint={hasActiveFilters ? t('admin.lists.applied', { count: activeCount }) : undefined} />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('admin.users.name')}</th>
                      <th>{t('admin.users.email')}</th>
                      <th>{t('admin.users.role')}</th>
                      <th>{t('admin.users.status')}</th>
                      <th>{t('admin.users.company')}</th>
                      <th className="col-hide-md">{t('admin.users.lastLogin')}</th>
                      <th>{t('admin.users.created')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <LoadingRows cols={tableCols} />
                    ) : (
                      filtered.map((u: any) => (
                        <tr key={u.id}>
                          <td className="mono-primary">{u.name}</td>
                          <td className="mono-muted">{u.email}</td>
                          <td><span className="badge badge-neutral">{u.role}</span></td>
                          <td>
                            <StatusBadge
                              status={accountStatusLabel(u.accountStatus)}
                              tone={ACCOUNT_TONES[u.accountStatus] ?? 'unknown'}
                            />
                          </td>
                          <td>{u.company || '—'}</td>
                          <td className="col-hide-md mono-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}</td>
                          <td className="mono-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </AdminCardBody>
        </AdminCard>
      </div>
    </AdminLayout>
  );
};